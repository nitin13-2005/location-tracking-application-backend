require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');
const { sql, connectDB } = require("./db");
const jwt = require('jsonwebtoken');
const app = express();
const server = http.createServer(app);

app.use(cors());
process.env.JWT_SECRET
app.use(express.json());

connectDB();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("liveLocation", async (data) => {
    try {
      const { userName, latitude, longitude } = data;

      if (!userName || latitude == null || longitude == null) {
        return;
      }

      await sql.query`
        MERGE Locations AS target
        USING (
          SELECT
            ${userName} AS UserName,
            ${latitude} AS Latitude,
            ${longitude} AS Longitude
        ) AS source
        ON target.UserName = source.UserName

        WHEN MATCHED THEN
          UPDATE SET
            Latitude = source.Latitude,
            Longitude = source.Longitude,
            CreatedAt = GETDATE()

        WHEN NOT MATCHED THEN
          INSERT (
            UserName,
            Latitude,
            Longitude
          )
          VALUES (
            source.UserName,
            source.Latitude,
            source.Longitude
          );
      `;

      io.emit("locationUpdated", {
        userName,
        latitude,
        longitude,
        updatedAt: new Date(),
      });

      console.log(
        `${userName}: ${latitude}, ${longitude}`
      );
    } catch (error) {
      console.error("Location Error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

app.get("/locations", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT *
      FROM Locations
      ORDER BY CreatedAt DESC
    `;

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post("/signup", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    email = email?.toLowerCase().trim();

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const checkUser = await sql.query`
      SELECT * 
      FROM Persons
      WHERE email = ${email}
    `;

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await sql.query`
      INSERT INTO Persons (name, email, password)
      OUTPUT INSERTED.id
      VALUES (${name}, ${email}, ${hashedPassword})
    `;

    const userId = result.recordset[0].id;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});


app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.toLowerCase().trim();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await sql.query`
      SELECT *
      FROM Persons
      WHERE email = ${email}
    `;

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.recordset[0];

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
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
      {
        expiresIn: "1h",
      }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

server.listen(5000, "0.0.0.0", () => {
  console.log("Server running on port 5000");
});