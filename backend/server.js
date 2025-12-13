const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')
const { check, validationResult } = require('express-validator')

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

// --- 1. КОНФИГУРАЦИЯ ДОСТУПА (Справочник активов на основе Цеха) ---
const ASSET_REGISTRY = {
  'Цех №2': ['Двигатель 1', 'Станок 5', 'Насосная Станция'],
  'Поле А': ['Почва (Сектор 1)', 'Теплица 101'],
}

// соединение с MongoDB
const mongoUri = 'mongodb://127.0.0.1:27017/newdb'
mongoose
  .connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err))

// Схема для коллекции пользователей
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

// Схема для коллекции сенсоров
const sensorReadingSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    last_updated: { type: Date, default: Date.now },
    sensor_type: { type: String, required: true },
    role: { type: String, required: true },
    wsection: { type: String, required: true },
    asset: { type: String, required: true },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    type: { type: String, required: false },
    thresholds: { type: Object, required: false },
  },
  { strict: false }, // Позволяет вставлять данные с полями, не указанными явно (например, из Python)
)

// Модель для Истории
const SensorDataHistory = mongoose.model('SensorDataHistory', sensorReadingSchema, 'sensor_data_histories')

// Модель для Текущего Состояния (Если вы используете отдельную коллекцию для текущих чтений)
const SensorCurrentStateModel = mongoose.model('SensorCurrentState', sensorReadingSchema, 'sensor_current_data')

const saltRounds = 10
const jwtSecret = 'your-secret-key'

const validatePassword = (password) => {
  // ... (Ваша логика валидации пароля остается прежней)
  let errors = []
  if (password.length < 4) errors.push('Пароль должен содержать не менее 4 символов.')
  if (!/[A-Z]/.test(password)) errors.push('Пароль должен содержать хотя бы одну заглавную букву.')
  if (!/[a-z]/.test(password)) errors.push('Пароль должен содержать хотя бы одну строчную букву.')
  if (!/[0-9]/.test(password)) errors.push('Пароль должен содержать хотя бы одну цифру.')
  if (!/[^a-zA-Z0-9]/.test(password))
    errors.push('Пароль должен содержать хотя бы один специальный символ (например, !@#$%^&*).')
  return errors
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) return res.sendStatus(401) // Нет токена

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.sendStatus(403) // <-- Если токен неверный, сервер возвращает 403
    req.user = user
    next()
  })
}

// --- Регистрация ---
app.post(
  '/register',
  [
    // Валидация
    check('username', 'Логин обязателен').notEmpty(),
    check('email', 'Неверный адрес электронной почты').isEmail(),
    check('password', 'Пароль должен быть не менее 4 символов').isLength({ min: 4 }),
    check('password').custom((password) => {
      const passwordValidationErrors = validatePassword(password)
      if (passwordValidationErrors.length > 0) {
        return Promise.reject(passwordValidationErrors.join('<br>'))
      }
      return true
    }),
    check('profession', 'Профессия обязательна').notEmpty(),
    check('wsection', 'Рабочий цех обязателен').notEmpty(),
    check('nameU', 'Имя пользователя обязательна').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, email, password, profession, nameU, wsection } = req.body

    try {
      // ... (Проверка на дубликаты и хэширование пароля)
      const existingUserWithEmail = await User.findOne({ email })
      if (existingUserWithEmail) return res.status(400).json({ message: 'Адрес электронной почты уже используется' })

      const existingUserWithUsername = await User.findOne({ username })
      if (existingUserWithUsername) return res.status(400).json({ message: 'Имя пользователя уже занято' })

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
      res.status(500).json({ message: 'Ошибка регистрации на сервере: ' + error.message })
    }
  },
)

// --- Login Endpoint (Где мы вычисляем права доступа) ---
app.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body
  console.log('--- SERVER: Login Attempt ---')
  console.log('Identifier SENT:', loginIdentifier)
  console.log('Identifier TYPE:', typeof loginIdentifier)
  try {
    const user = await User.findOne({
      $or: [{ username: loginIdentifier }, { email: loginIdentifier }],
    })

    if (!user) {
      return res.status(400).json({ message: 'Неправильный логин или пароль!' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    const userWSection = user.wsection // Например, 'Цех №2'

    if (isMatch) {
      // *** ВЫЧИСЛЕНИЕ ПРАВ НА ОСНОВЕ ASSET_REGISTRY ***
      const allowedAssets = ASSET_REGISTRY[userWSection] || []
      const allowedSections = [userWSection]
      // ***************************************************

      const token = jwt.sign(
        {
          userId: user._id,
          username: user.username,
          profession: user.profession,
          wsection: userWSection,
          nameU: user.nameU,
          access_rights: {
            // Встраиваем права в токен
            allowedSections: allowedSections,
            allowedAssets: allowedAssets,
          },
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
          wsection: userWSection,
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

app.use((req, res, next) => {
  // Проверяем, является ли роут публичным, и если да, пропускаем Middleware
  if (req.path === '/login' || req.path === '/register') {
    return next()
  }

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Если нет заголовка Authorization (например, на /sensor-data при первом запросе без токена)
    console.warn(`Unauthorized access attempt on path: ${req.path}`)
    return res.status(401).json({ message: 'Токен авторизации отсутствует или имеет неверный формат.' })
  }

  const token = authHeader.split(' ')[1] // Берем только сам токен

  jwt.verify(token, jwtSecret, (err, userPayload) => {
    if (err) {
      console.error('JWT verification error:', err.message)
      return res.status(401).json({ message: 'Невалидный или просроченный токен.' })
    }

    // ТОЛЬКО устанавливаем данные из токена в запрос
    req.user = userPayload

    console.log('JWT verified. User data in req.user:', userPayload)
    next() // Передаем управление следующему Middleware или роуту
  })
})

// GET /sensor-data (Получение данных)
app.get('/sensor-data', async (req, res) => {
  try {
    if (!req.user || !req.user.access_rights) {
      // Возвращаем 403, которое Axios ловит как ошибку
      return res.status(403).json({ message: 'Access rights missing in token.' })
    }

    const { allowedSections, allowedAssets } = req.user.access_rights

    console.log('User Sections:', allowedSections)
    console.log('User Assets:', allowedAssets)

    if (!allowedSections || allowedSections.length === 0 || !allowedAssets || allowedAssets.length === 0) {
      // Это вызывает 403 Forbidden, который ловится в React
      return res.status(403).json({ message: 'User has no access rights defined.' })
    }

    const query = {
      wsection: { $in: allowedSections },
      asset: { $in: allowedAssets },
    }

    // Запрос к новой коллекции истории
    const sensorData = await SensorCurrentStateModel.find(query).lean()

    res.status(200).json(sensorData)
  } catch (error) {
    console.error('*** SERVER CRASHED DURING SENSOR DATA FETCH ***', error)
    res.status(500).json({ message: 'Failed to retrieve sensor data' })
  }
})

app.get('/api/assets', (req, res) => {
  // Middleware уже проверил токен, поэтому req.user существует
  if (!req.user || !req.user.access_rights) {
    return res.status(403).json({ message: 'Доступ запрещен: нет прав доступа в токене.' })
  }

  // Возвращаем только то, что нужно для отображения справочника
  const { allowedSections, allowedAssets } = req.user.access_rights

  res.status(200).json({
    allowedSections,
    availableAssets: allowedAssets,
  })
})

app.get('/api/overview-stats', authenticateToken, async (req, res) => {
  try {
    // 1. Общее количество сенсоров в коллекции текущих данных
    const totalSensors = await SensorCurrentStateModel.countDocuments({})

    // 2. Количество предупреждений.
    const activeAlerts = await SensorCurrentStateModel.countDocuments({
      value: { $gt: 10 }, //
    })

    // 3. Время последнего обновления (наиболее свежий timestamp)
    const latestReading = await SensorCurrentStateModel.findOne()
      .sort({ last_updated: -1 })
      .select('last_updated')
      .lean()

    const lastUpdated = latestReading ? latestReading.last_updated : null

    res.status(200).json({
      totalSensors,
      activeAlerts,
      lastUpdated,
    })
  } catch (error) {
    console.error('Error fetching overview stats:', error)
    res.status(500).json({ message: 'Не удалось получить сводную статистику.' })
  }
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
