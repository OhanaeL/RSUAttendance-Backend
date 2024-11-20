require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL, // Example: 'https://your-client.netlify.app'
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);

const rooms = {}; // To store active rooms and their data

io.on('connection', (socket) => {
  console.log('A user connected');
  console.log(`Currently connected users: ${io.engine.clientsCount}`);

  // Teacher creates and joins a room
  socket.on('createAndJoinRoom', (roomData) => {
  const { roomId, subject, session, time, location, createdAt } = roomData;
  console.log(roomData)
  console.log(location)
  console.log(createdAt)

  // Check if the room already exists
  if (rooms[roomId]) {
    socket.emit('error', { message: 'Room already exists' });
    return;
  }

  // Create the room
  rooms[roomId] = {
    subject,
    session,
    time,
    attendees: [
    ],
  };

  console.log(`Room created and joined: ${roomId} with subject ${subject}`);

  // Add the teacher to the room in Socket.IO
  socket.join(roomId);

  // Notify the teacher of successful creation and joining
  socket.emit('roomCreatedAndJoined', {
    roomId,
    message: 'Room created and joined successfully',
  });

  // Notify all participants in the room of the updated attendees list
  io.to(roomId).emit('attendanceUpdate', rooms[roomId].attendees);
  });
  // Teacher creates a new room
  socket.on('createRoom', (roomData) => {
    const { roomId, subject, session, time } = roomData;
    rooms[roomId] = {
      subject,
      session,
      time,
      attendees: [] // Initially empty list of attendees
    };

    console.log(`Room created: ${roomId}`);
    socket.emit('roomCreated', { roomId, message: 'Room created successfully' });
  });

  // Handle request for checking attendance
  socket.on('checkAttendance', (roomId) => {
    if (rooms[roomId]) {
      // Emit the list of attendees for the requested room to the teacher
      const attendees = rooms[roomId].attendees;
      socket.emit('attendanceUpdate', attendees); // Emit only to the requesting teacher
    } else {
      // Room not found
      socket.emit('error', { message: 'Room not found' });
    }
  });

  // Handle request for checking attendance
  socket.on('downloadAttendence', (roomId) => {
    if (rooms[roomId]) {
      // Emit the list of attendees for the requested room to the teacher
      const attendees = rooms[roomId].attendees;
      socket.emit('downloadAttendenceUpdate', attendees); // Emit only to the requesting teacher
    } else {
      // Room not found
      socket.emit('error', { message: 'Room not found' });
    }
  });

  socket.on("teacherJoinRoom", (roomID) => {
    const room = rooms[roomID]; // Fetch the room from the rooms object
  
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
  
    console.log(`Teacher joined back room ${roomID}`);
  
    // Add the teacher to the room in Socket.IO (roomId is the identifier)
    socket.join(roomID);
  
    // Notify only the clients in the room (e.g., teacher and students in that room)
    io.to(roomID).emit('attendanceUpdate', room.attendees);
  
    socket.emit('joinedRoom', { roomID, message: 'Joined the room successfully' });
  });
  

  // Student joins a room
  socket.on('joinRoom', (data) => {
    const { roomId, studentName, studentId } = data;

    if (rooms[roomId]) {
      const room = rooms[roomId];

      // Add student to room attendance
      room.attendees.push({ studentName, studentId });
      console.log(`${studentName} joined room ${roomId}`);

      // Add the student to the room in Socket.IO (roomId is the identifier)
      socket.join(roomId);

      // Notify only the clients in the room (e.g., teacher and students in that room)
      io.to(roomId).emit('attendanceUpdate', room.attendees);

      socket.emit('joinedRoom', { roomId, message: 'Joined the room successfully' });
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  // Teacher ends a room
  socket.on('end-room', async (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('room-error', 'Room not found');
      return;
    }
    delete rooms[roomId];
    console.log(`Room ${roomId} ended`);
  });

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected');
    console.log(`Currently connected users: ${io.engine.clientsCount}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
