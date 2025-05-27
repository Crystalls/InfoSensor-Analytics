const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // Import mongoose
const { type } = require('@testing-library/user-event/dist/type');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3001;
app.use(cors());
app.use(express.json());

// MongoDB Connection
const mongoUri = 'mongodb://127.0.0.1:27017/newdb'; // Replace with your MongoDB URI
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    userId: {type: String, unique: true, required: true, default: uuidv4},
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profession: { type: String, required: true },
    wsection: { type: String, required: true },

});

const User = mongoose.model('User', userSchema);

// Sensor Data Schema (Example)
const sensorDataSchema = new mongoose.Schema({
    sensorId: { type: String, required: true },
    crop_type: { type: String, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    farm_id: { type: String, required: true },
    role: { type: String, enum: ['scientist', 'engineer', 'user'], required: true }, // Reference to User
    wsection: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const SensorData = mongoose.model('SensorData', sensorDataSchema, 'sensordatas');

const saltRounds = 10;
const jwtSecret = 'your-secret-key';


// Registration Endpoint
app.post('/register', async (req, res) => {
    const { username,
            email, 
            password, 
            profession,
            wsection } = req.body;

    console.log(req.body)

    if (!username) {
        return res.status(400).json({ message: 'Введите логин!' });
    }

    if (!password) {
        return res.status(400).json({ message: 'Требуется ввести пароль!' });
    }

    if (!profession) {
        return res.status(400).json({ message: 'Требуется выбрать профессию!' });
    }

    if (!wsection) {
        return res.status(400).json({ message: 'Требуется ввести название участка' })
    }

    try {
        // 1. Проверка существования email и username ПЕРЕД созданием пользователя.
        const emailExists = await User.findOne({ email: email });
        if (emailExists) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const userExists = await User.findOne({ username: username });
        if (userExists) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // 2. Хэширование пароля.  Это нужно делать *только* если email и username свободны.
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Создание нового пользователя.
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            profession,
            wsection,
        });

        // 4. Сохранение пользователя в базе данных.
        await newUser.save();

        // 5. Отправка успешного ответа.
        res.status(201).json({ message: 'User registered successfully' });

    } catch (error) {
        // 6. Обработка ошибок, связанных с базой данных (например, ошибка валидации, ошибка подключения).
        console.error('Registration error:', error);

        if (error.name === 'ValidationError') {
            // Ошибка валидации (например, уникальность полей)
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: 'Validation error: ' + messages.join(', ') });
        } else {
            // Другие ошибки (например, ошибка подключения к базе данных)
            res.status(500).json({ message: 'Registration failed: ' + error.message });
        }
    }
});


// Login Endpoint
app.post('/login', async (req, res) => {
    const { loginIdentifier, password } = req.body;

    try {
        const user = await User.findOne({ 
            $or: [{username: loginIdentifier}, {email: loginIdentifier}]
        });

        if (!user) {
            return res.status(400).json({ message: 'Неправильный логин или пароль!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            const token = jwt.sign(
                { userId: user._id, username: user.username, profession: user.profession, wsection: user.wsection },
                jwtSecret,
                { expiresIn: '1h' }
            );
            res.status(200).json({
                token,
                user: { id: user._id, username: user.username, profession: user.profession, wsection: user.wsection },
            });
        } else {
            return res.status(400).json({ message: 'Неправильный логин или пароль!' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Login failed' });
    }
});


// Authentication middleware (Example - adjust as needed)
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;

    console.log("Authentication middleware called"); // Add this line
    console.log("Authorization header:", authHeader);   // Add this line

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, jwtSecret, (err, user) => {
            if (err) {
                console.error("JWT verification error:", err); // Add this line
                return res.status(401).json({ message: "Невалидный токен" }); // Forbidden
            }

            console.log("JWT verified:", user); // Add this line
            req.user = user;
            next();
        });
    } else {
        console.log("No Authorization header found"); // Add this line
        return res.status(401).json({ message: "Непредусмотренный токен" }); // Unauthorized
    }
});

app.post('/sensor-data', async (req, res) => {
    const { sensorId, crop_type, temperature, humidity } = req.body;
    const userId = req.user.userId;

    try {
        const newSensorData = new SensorData({
            sensorId,
            crop_type,
            temperature,
            humidity,
            userId,
            wsection,
        });
        await newSensorData.save();
        res.status(201).json({ message: 'Sensor data saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to save sensor data' });
    }
});

// Example endpoint to get sensor data for a user
app.get('/sensor-data', async (req, res) => {  //Added async here
    const userRole  = req.user.profession; // Assuming you have authentication middleware
    const userWsection = req.user.wsection;

    try {
        if (!userRole || !userWsection) {
            return res.status(403).json({ message: 'User role and wsection are required to access sensor data.' });
        }
         const sensorData = await SensorData.find({ role: userRole, wsection: userWsection}); // Find by userRole
         console.log("Sensor Data", sensorData)
         res.status(200).json(sensorData);

        } 
    catch (error) {
        console.error("Error fetching sensor data:", error);
        res.status(500).json({ message: 'Failed to retrieve sensor data' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});