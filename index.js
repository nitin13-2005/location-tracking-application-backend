require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const usersFile = path.join(__dirname, "users.json");
const locationsFile = path.join(__dirname, "locations.json");

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
}

if (!fs.existsSync(locationsFile)) {
  fs.writeFileSync(locationsFile, JSON.stringify([], null, 2));
}

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const users = JSON.parse(
      fs.readFileSync(usersFile, "utf8")
    );

    const exists = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    users.push({
      id: Date.now(),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });

    fs.writeFileSync(
      usersFile,
      JSON.stringify(users, null, 2)
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = JSON.parse(
      fs.readFileSync(usersFile, "utf8")
    );

    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// SOCKET LOCATION TRACKING
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("liveLocation", (data) => {
    try {
      const { userName, latitude, longitude } = data;

      if (!userName || latitude == null || longitude == null) {
        return;
      }

      let locations = JSON.parse(
        fs.readFileSync(locationsFile, "utf8")
      );

      const index = locations.findIndex(
        (u) => u.userName === userName
      );

      const locationData = {
        userName,
        latitude,
        longitude,
        updatedAt: new Date().toISOString(),
      };

      if (index !== -1) {
        locations[index] = locationData;
      } else {
        locations.push(locationData);
      }

      fs.writeFileSync(
        locationsFile,
        JSON.stringify(locations, null, 2)
      );

      io.emit("locationUpdated", locationData);

      console.log(
        `${userName}: ${latitude}, ${longitude}`
      );
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

// GET ALL LOCATIONS
app.get("/locations", (req, res) => {
  try {
    const locations = JSON.parse(
      fs.readFileSync(locationsFile, "utf8")
    );

    res.json({
      success: true,
      locations,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Running On Port ${PORT}`);
});