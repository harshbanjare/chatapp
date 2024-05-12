import 'dotenv/config';
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import User from "./models/user.model.js";
import { auth } from './middleware/auth.js';
import { createServer } from "http";
import  Message  from "./models/message.model.js";

import { Server } from "socket.io";

import jsonwebtoken from "jsonwebtoken";

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});


io.use((socket, next) => {

    const token = socket.handshake.headers.authorization.split(" ")[1];

    if (!token) {
        return next(new Error("Authentication failed"));
    }

    try {
        const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (error) {
        console.log(error);
        return next(
            new Error("Authentication failed")
        );
    }
});

io.on("connection", async (socket) => {
    console.log("User connected", socket.user);
    socket.on("disconnect", async () => {
        console.log("User disconnected", socket.user);

        await User.updateOne(
            { username: socket.user.username },
            { status: "busy"}
        );
    }
    );
  
    socket.join(socket.user.username);

    await User.updateOne(
        { username: socket.user.username },
        { status: "Available" }
    );
    
    socket.on("sendMessage", async (data) => {


        const { receiver, message } = data;

        const newMessage = new Message({
            message,
            sender: socket.user.username,
            receiver,
        });

        await newMessage.save();

        io.to(receiver).emit("receiveMessage", {
            sender: socket.user.username,
            message,
        });

    });

});


app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("Hello World!");
    }
);

app.post("/register", async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
    }

    try{
        const user = new User({ username, password, email });
        await user.save();
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ message: "error"});
    }

    return res.status(201).json({ message: "User created successfully" });

});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

  const user = await User
    .findOne({
        username,
        password,
    });

    if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
    }


    if (user.password !== password) {
        return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jsonwebtoken.sign({ username }, process.env.JWT_SECRET);
    return res.status(200).json({ token });  
}); 


app.get("/fetchUserList", auth, async (req, res) => {
    const users = await User.find();

    const filteredUsers = users.map((user) => {
        return {
            username: user.username,
            email: user.email,
            status: user.status,
        };
    }
    );

    return res.status(200).json({ filteredUsers });
});





mongoose
    .connect(process.env.DB_CONNECTION_STRING)
    .then(() => {
        console.log("MongoDB connected");
        server.listen(3000, () => {
            console.log("Server is running on port 3000");
        });
    })
    .catch((err) => console.log(err));