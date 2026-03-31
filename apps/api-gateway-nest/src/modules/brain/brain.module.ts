// apps/api-gateway-nest/src/modules/brain/brain.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { BrainController } from './brain.controller';
import { BrainService } from './brain.service';
import { MlBridgeModule } from '../../ml-bridge/ml-bridge.module';
import { CircuitBreakerModule } from '../../common/circuit-breaker/circuit-breaker.module';

/**
 * BrainModule
 * Wires the HTTP ML Bridge (primary transport) and a gRPC ClientGrpc
 * (high-performance streaming transport) to the FastAPI Brain service.
 *
 * The gRPC client uses the shared proto contract from libs/proto/jarvis_brain.proto.
 * In production, set GRPC_TLS_CERT / GRPC_TLS_KEY / GRPC_TLS_CA for mTLS.
 */
@Module({
  imports: [
    MlBridgeModule,
    CircuitBreakerModule,

    // gRPC Neural Link client — for StreamThought and low-latency Reason calls
    ClientsModule.register([
      {
        name: 'BRAIN_GRPC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'jarvis.v1',
          protoPath: join(process.cwd(), '../../libs/proto/jarvis_brain.proto'),
          url: process.env.GRPC_BRAIN_URL || 'ml-agent:50051',
          // TLS credentials are loaded automatically via gRPC channel options
          // when GRPC_TLS_* env vars are set in grpc_server.py on the Python side.
          channelOptions: {
            'grpc.max_receive_message_length': 16 * 1024 * 1024,
            'grpc.max_send_message_length': 16 * 1024 * 1024,
          },
        },
      },
    ]),
  ],
  controllers: [BrainController],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
