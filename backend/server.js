const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose') // Import mongoose
const { v4: uuidv4 } = require('uuid')
const { check, validationResult } = require('express-validator')

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

// MongoDB Connection
const mongoUri = 'mongodb://127.0.0.1:27017/newdb' // Replace with your MongoDB URI
mongoose
  .connect(mongoUri)

  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err))

// User Schema
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true, default: uuidv4 },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profession: { type: String, required: true },
  wsection: { type: String, required: true },
  nameU: { type: String, required: true },
})

const User = mongoose.model('User', userSchema)

// Sensor Data Schema (Example)
const sensorDataSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  crop_type: { type: String, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  farm_id: { type: String, required: true },
  role: {
    type: String,
    enum: ['scientist', 'engineer', 'user'],
    required: true,
  }, // Reference to User
  wsection: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
})

const SensorData = mongoose.model('SensorData', sensorDataSchema, 'sensor_current_data')

const saltRounds = 10
const jwtSecret = 'your-secret-key'

const validatePassword = (password) => {
  let errors = []

  if (password.length < 4) {
    errors.push('Пароль должен содержать не менее 4 символов.')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну заглавную букву.')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну строчную букву.')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну цифру.')
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы один специальный символ (например, !@#$%^&*).')
  }

  return errors
}

// Registration Endpoint
app.post(
  '/register',
  [
    // Валидация
    check('username', 'Логин обязателен').notEmpty(),
    check('email', 'Неверный адрес электронной почты').isEmail(),
    check('password', 'Пароль должен быть не менее 4 символов').isLength({
      min: 4,
    }),
    check('password').custom((password) => {
      const passwordValidationErrors = validatePassword(password)

      if (passwordValidationErrors.length > 0) {
        return Promise.reject(passwordValidationErrors.join('<br>'))
      }
      return true
    }),
    check('profession', 'Профессия обязательна').notEmpty(),
    check('wsection', 'Рабочий участок обязателен').notEmpty(),
    check('nameU', 'Имя пользователя обязательна').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array()) // Логирование ошибок валидации
      return res.status(400).json({ errors: errors.array() }) // Возвращаем ошибки валидации
    }

    const { username, email, password, profession, nameU, wsection } = req.body

    try {
      const existingUserWithEmail = await User.findOne({ email })
      if (existingUserWithEmail) {
        console.log('Email уже существует')
        return res.status(400).json({ message: 'Адрес электронной почты уже используется' })
      }

      const existingUserWithUsername = await User.findOne({ username })
      if (existingUserWithUsername) {
        console.log('Имя пользователя уже существует')
        return res.status(400).json({ message: 'Имя пользователя уже занято' })
      }

      const hashedPassword = await bcrypt.hash(password, saltRounds)

      const newUser = new User({
        username,
        email,
        password: hashedPassword,
        profession,
        wsection,
        nameU,
      })

      await newUser.save()

      res.status(201).json({ message: 'Пользователь успешно зарегистрирован' })
    } catch (error) {
      console.error('Ошибка регистрации:', error)
      res.status(500).json({ message: 'Ошибка регистрации на сервере: ' + error.message }) // Include the error message
    }
  },
)

// Login Endpoint
app.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body

  try {
    const user = await User.findOne({
      $or: [{ username: loginIdentifier }, { email: loginIdentifier }],
    })

    if (!user) {
      return res.status(400).json({ message: 'Неправильный логин или пароль!' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (isMatch) {
      const token = jwt.sign(
        {
          userId: user._id,
          username: user.username,
          profession: user.profession,
          wsection: user.wsection,
          nameU: user.nameU,
        },
        jwtSecret,
        { expiresIn: '1h' },
      )
      res.status(200).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          profession: user.profession,
          wsection: user.wsection,
          nameU: user.nameU,
        },
      })
    } else {
      return res.status(400).json({ message: 'Неправильный логин или пароль!' })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Login failed' })
  }
})

// Authentication middleware (Example - adjust as needed)
app.use((req, res, next) => {
  const authHeader = req.headers.authorization

  console.log('Authentication middleware called')
  console.log('Authorization header:', authHeader)

  if (authHeader) {
    const token = authHeader.split(' ')[1]

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        console.error('JWT verification error:', err)
        return res.status(401).json({ message: 'Невалидный токен' }) // Forbidden
      }

      console.log('JWT verified:', user)
      req.user = user
      next()
    })
  } else {
    console.log('No Authorization header found')
    return res.status(401).json({ message: 'Непредусмотренный токен' }) // Unauthorized
  }
})

app.post('/sensor-data', async (req, res) => {
  const { sensorId, crop_type, temperature, humidity, wsection } = req.body
  const userId = req.user.userId

  try {
    const newSensorData = new SensorData({
      sensorId,
      crop_type,
      temperature,
      humidity,
      userId,
      wsection,
    })
    await newSensorData.save()
    res.status(201).json({ message: 'Sensor data saved successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to save sensor data' })
  }
})

// Example endpoint to get sensor data for a user
app.get('/sensor-data', async (req, res) => {
  //Added async here
  const userRole = req.user.profession // Assuming you have authentication middleware
  const userWsection = req.user.wsection

  try {
    if (!userRole || !userWsection) {
      return res.status(403).json({
        message: 'User role and wsection are required to access sensor data.',
      })
    }
    const sensorData = await SensorData.find({
      role: userRole,
      wsection: userWsection,
    }) // Find by userRole
    console.log('Sensor Data', sensorData)
    res.status(200).json(sensorData)
  } catch (error) {
    console.error('Error fetching sensor data:', error)
    res.status(500).json({ message: 'Failed to retrieve sensor data' })
  }
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
