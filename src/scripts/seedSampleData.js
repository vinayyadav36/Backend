require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Guest = require('../models/Guest');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');

const run = async () => {
  try {
    await connectDB();

    console.log('Seeding sample data...');

    // Create admin user if not exists
    let admin = await User.findOne({ email: 'admin@example.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Admin123',
        role: 'admin',
        permissions: ['all'],
      });
      console.log('Created admin user admin@example.com / Admin123');
    }

    // Create rooms
    await Room.deleteMany({});
    const rooms = await Room.insertMany([
      {
        number: '101',
        type: 'single',
        status: 'available',
        floor: 1,
        capacity: { adults: 2, children: 1 },
        rate: { baseRate: 3000 },
      },
      {
        number: '102',
        type: 'double',
        status: 'available',
        floor: 1,
        capacity: { adults: 3, children: 2 },
        rate: { baseRate: 4000 },
      },
      {
        number: '201',
        type: 'suite',
        status: 'available',
        floor: 2,
        capacity: { adults: 4, children: 2 },
        rate: { baseRate: 6000 },
      },
    ]);

    // Create 5 guests
    await Guest.deleteMany({});
    const guests = await Guest.insertMany([
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '+91-9000000001',
        idType: 'passport',
        idNumber: 'P1234567',
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        phone: '+91-9000000002',
        idType: 'aadhar',
        idNumber: '1234-5678-9012',
      },
      {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        phone: '+91-9000000003',
        idType: 'driving_license',
        idNumber: 'DL-09-123456',
      },
      {
        name: 'Diana Prince',
        email: 'diana@example.com',
        phone: '+91-9000000004',
        idType: 'passport',
        idNumber: 'P7654321',
      },
      {
        name: 'Edward King',
        email: 'edward@example.com',
        phone: '+91-9000000005',
        idType: 'voter_id',
        idNumber: 'VOTER-12345',
      },
    ]);

    // Create bookings and invoices
    await Booking.deleteMany({});
    await Invoice.deleteMany({});

    const today = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    const sampleBookings = [];

    const mkDate = (offsetDays) =>
      new Date(today.getTime() + offsetDays * oneDay);

    sampleBookings.push({
      guest: guests[0]._id,
      room: rooms[0]._id,
      checkInDate: mkDate(-2),
      checkOutDate: mkDate(1),
      adults: 2,
      children: 0,
      status: 'checked-in',
      source: 'online',
      totalAmount: 3 * rooms[0].rate.baseRate,
      paidAmount: 3 * rooms[0].rate.baseRate,
      paymentStatus: 'paid',
      createdBy: admin._id,
    });

    sampleBookings.push({
      guest: guests[1]._id,
      room: rooms[1]._id,
      checkInDate: mkDate(-7),
      checkOutDate: mkDate(-4),
      adults: 2,
      children: 1,
      status: 'checked-out',
      source: 'direct',
      totalAmount: 3 * rooms[1].rate.baseRate,
      paidAmount: 3 * rooms[1].rate.baseRate,
      paymentStatus: 'paid',
      createdBy: admin._id,
    });

    sampleBookings.push({
      guest: guests[2]._id,
      room: rooms[2]._id,
      checkInDate: mkDate(3),
      checkOutDate: mkDate(6),
      adults: 3,
      children: 1,
      status: 'confirmed',
      source: 'online',
      totalAmount: 3 * rooms[2].rate.baseRate,
      paidAmount: 0,
      paymentStatus: 'pending',
      createdBy: admin._id,
    });

    sampleBookings.push({
      guest: guests[3]._id,
      room: rooms[0]._id,
      checkInDate: mkDate(10),
      checkOutDate: mkDate(12),
      adults: 1,
      children: 0,
      status: 'pending',
      source: 'phone',
      totalAmount: 2 * rooms[0].rate.baseRate,
      paidAmount: 0,
      paymentStatus: 'pending',
      createdBy: admin._id,
    });

    sampleBookings.push({
      guest: guests[4]._id,
      room: rooms[1]._id,
      checkInDate: mkDate(-1),
      checkOutDate: mkDate(2),
      adults: 2,
      children: 0,
      status: 'confirmed',
      source: 'walk-in',
      totalAmount: 3 * rooms[1].rate.baseRate,
      paidAmount: rooms[1].rate.baseRate,
      paymentStatus: 'partial',
      createdBy: admin._id,
    });

    const bookings = await Booking.insertMany(sampleBookings);

    // Update room statuses based on bookings
    for (const booking of bookings) {
      let status = 'available';
      if (booking.status === 'confirmed') status = 'reserved';
      if (booking.status === 'checked-in') status = 'occupied';

      await Room.findByIdAndUpdate(booking.room, { status });
    }

    // Create invoices for paid/partial bookings
    const invoicesData = bookings
      .filter((b) => b.paidAmount > 0)
      .map((b, idx) => ({
        invoiceNumber: `INV-SAMPLE-${idx + 1}`,
        booking: b._id,
        guest: b.guest,
        items: [
          {
            description: 'Room charges',
            quantity: 1,
            unitPrice: b.totalAmount,
            totalPrice: b.totalAmount,
            category: 'room',
          },
        ],
        subtotal: b.totalAmount,
        taxAmount: Math.round(b.totalAmount * 0.12),
        discountAmount: 0,
        totalAmount: Math.round(b.totalAmount * 1.12),
        status: b.paymentStatus === 'paid' ? 'paid' : 'sent',
        paymentMethod: 'card',
        paymentDate: b.paymentStatus === 'paid' ? new Date() : null,
        dueDate: mkDate(7),
        createdBy: admin._id,
      }));

    if (invoicesData.length) {
      await Invoice.insertMany(invoicesData);
    }

    console.log('Sample data seeded successfully.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

run();


