# apps/ml-agent-fastapi/services/rag_service.py
"""
Jarvis RAG (Retrieval-Augmented Generation) service.
Uses LangChain + MongoDB Atlas Vector Search to answer questions from
hotel/business documents (PDFs, Excel, policy docs).
"""
from typing import Dict, Any


class RAGService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    async def query_knowledge_base(self, question: str) -> Dict[str, Any]:
        """
        1. Embed the question with OpenAI Embeddings.
        2. Similarity-search the tenant's Atlas Vector index.
        3. Pass top-k docs + question to the LLM for a grounded answer.
        """
        try:
            from langchain_mongodb import MongoDBAtlasVectorSearch
            from langchain_openai import OpenAIEmbeddings, ChatOpenAI
            from langchain.chains import RetrievalQA
            import pymongo, os

            client = pymongo.MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
            collection = client[os.getenv("DB_NAME", "jarvis")]["knowledge_base"]

            embeddings = OpenAIEmbeddings()
            vector_store = MongoDBAtlasVectorSearch(
                collection=collection,
                embedding=embeddings,
                index_name="vector_index",
                # Filter to this tenant's documents only
                pre_filter={"tenant_id": {"$eq": self.tenant_id}},
            )

            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
            qa = RetrievalQA.from_chain_type(
                llm=llm,
                retriever=vector_store.as_retriever(search_kwargs={"k": 3}),
            )
            answer = qa.run(question)
            return {"answer": answer, "tenant_id": self.tenant_id}

        except ImportError:
            return {
                "answer": "RAG dependencies (langchain-mongodb, langchain-openai) not installed.",
                "tenant_id": self.tenant_id,
            }
