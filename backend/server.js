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
  'Цех №1': ['Токарный станок', 'Станок ЧПУ', 'Паровой станок'],
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
  },
  { strict: false }, // Позволяет вставлять данные с полями, не указанными явно (например, из Python)
)

const ThresholdConfigSchema = new mongoose.Schema(
  {
    asset: { type: String, required: true }, // Имя Актива (напр., "Токарный станок")
    sensorId: { type: String, required: true }, // ID Сенсора (напр., "SNSR-0202")
    threshold: { type: Number, required: true }, // Пороговое значение
    sensor_type: { type: String, required: true },
  },
  { timestamps: true },
)

// Обеспечиваем уникальность пары Актив-Сенсор
ThresholdConfigSchema.index({ asset: 1, sensorId: 1 }, { unique: true })

const ThresholdByTypeModelSchema = new mongoose.Schema({
  sensor_type: { type: String, required: true }, // Имя Актива (напр., "Токарный станок")
  min_value: { type: Number, required: true }, // ID Сенсора (напр., "SNSR-0202")
  max_value: { type: Number, required: true }, // Пороговое значение
  sensor_type: { type: String, required: true },
  unit: { type: String, required: true },
})

/*
const sensorReportsSchema = new mongoose.Schema(
  {
    report_name: { type: String, required: true },
    generatedBy: { type: String, required: true },
    report_type: { type: String, required: true },
    generationDate: { type: Date, default: Date.now },
    periodStart: { type: Date, default: Date.now },
    periodEnd: { type: Date, default: Date.now },
    fileUrl: { type: String },
    parameters: { type: Object },
  },
)
*/

/*
const sensorAlertsSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true },
    alert_type: { type: String, required: true },
    message: { type: String, required: true },
    value: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean },
    resolvedby: { type: String },
    resolvedAt: { type: Date, default: Date.now },
  },
)
*/

// Модель для Истории
const SensorDataHistory = mongoose.model('SensorDataHistory', sensorReadingSchema, 'sensor_data_histories')
/*
 Модель для отчетов
const sensorReportsSchema = mongoose.model('sensorReportsSchema', sensorReportsSchema, 'sensor_reports')

// Модель для оповещений
const sensorAlertsSchema = mongoose.model('sensorAlertsSchema', sensorAlertsSchema, 'sensor_alerts')
*/

// Модель для Текущего Состояния
const SensorCurrentStateModel = mongoose.model('SensorCurrentState', sensorReadingSchema, 'sensor_current_data')

// Модель для конфигурирования пороговых значений
const ThresholdConfigModel = mongoose.model('ThresholdConfig', ThresholdConfigSchema, 'threshold_config')

const ThresholdByTypeModel = mongoose.model('ThresholdByType', ThresholdByTypeModelSchema, 'threshold_by_type_config')

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
        { expiresIn: '36h' },
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

// --- РОУТ СПИСКА (обновленный) ---
app.get('/api/assets-with-live-data', authenticateToken, async (req, res) => {
  if (!req.user || !req.user.access_rights || !req.user.access_rights.allowedAssets) {
    return res.status(403).json({ message: 'Доступ запрещен: нет списка активов.' })
  }

  const allowedAssets = req.user.access_rights.allowedAssets
  const userWorkshop = req.user.wsection

  // 1. Находим последние показания для ВСЕХ доступных сенсоров, связанных с этими активами
  // (Это может быть ресурсоемко, но соответствует структуре данных)
  const currentStates = await SensorCurrentStateModel.find({ asset: { $in: allowedAssets } })
    .sort({ last_updated: -1 })
    .select('asset sensor_id value last_updated')
    .lean()

  // 2. Находим все конфигурации порогов для этих активов
  const thresholdsMap = new Map()
  const thresholdConfigs = await ThresholdConfigModel.find({ asset: { $in: allowedAssets } }).lean()

  thresholdConfigs.forEach((config) => {
    // Ключ: "ИмяАктива|SensorID"
    thresholdsMap.set(`${config.asset}|${config.sensorId}`, config.threshold)
  })

  // 3. Группируем и агрегируем данные по Активам
  const assetSummary = new Map()

  currentStates.forEach((state) => {
    const key = state.asset

    // Если Актив еще не в итоговой карте, инициализируем его
    if (!assetSummary.has(key)) {
      assetSummary.set(key, {
        name: key,
        workshop: userWorkshop,
        status: 'Активен', // Начальное состояние
        statusColor: 'text-success',
        lastValue: 'N/A',
        lastTimestamp: 'N/A',
        sensorCount: 0, // Для понимания, сколько сенсоров у актива
        activeSensors: 0, // Для расчета общего статуса
        alarmSensors: 0,
      })
    }

    const summary = assetSummary.get(key)
    summary.sensorCount++

    const threshold = thresholdsMap.get(`${key}|${state.sensor_id}`)
    const isAlarm = threshold && state.value > threshold

    if (isAlarm) {
      summary.alarmSensors++
    }

    // Обновляем сводные данные (берем самые свежие, хотя они уже отсортированы)
    summary.lastValue = state.value.toFixed(2)
    summary.lastTimestamp = new Date(state.last_updated).toLocaleTimeString()
  })

  // 4. Финальная обработка статуса
  const results = Array.from(assetSummary.values()).map((summary) => {
    if (summary.alarmSensors > 0) {
      summary.status = 'Тревога'
      summary.statusColor = 'text-danger'
    } else if (summary.sensorCount === 0) {
      summary.status = 'Нет данных'
      summary.statusColor = 'text-secondary'
    } else {
      summary.status = 'Активен'
      summary.statusColor = 'text-success'
    }

    // В сводке мы покажем последнее показание, которое мы нашли
    return summary
  })

  res.status(200).json(results)
})

app.get('/api/assets/:assetName', authenticateToken, async (req, res) => {
  const assetName = req.params.assetName
  const { access_rights, wsection, nameU } = req.user

  if (!access_rights || !access_rights.allowedAssets.includes(assetName)) {
    return res.status(403).json({ message: `Доступ к активу ${assetName} запрещен.` })
  }

  try {
    // 1. Находим пороги для этого актива
    const thresholdConfigs = await ThresholdConfigModel.find({ asset: assetName }).lean()
    const thresholdsMap = new Map(thresholdConfigs.map((c) => [c.sensorId, c.threshold]))

    // 2. Находим показания для всех сенсоров этого актива
    const currentStates = await SensorCurrentStateModel.find({ asset: assetName }).sort({ last_updated: -1 }).lean()

    // 3. Агрегируем и обогащаем данные
    const sensorDetailsPromises = currentStates.map(async (state) => {
      const threshold = thresholdsMap.get(state.sensor_id)
      const status = threshold && state.value > threshold ? 'Тревога' : 'ОК'
      const statusColor = status === 'Тревога' ? 'text-danger' : 'text-success'

      return {
        type: state.sensor_type, // Берем тип из показаний
        sensorId: state.sensor_id,
        threshold: threshold || 'N/A',
        currentValue: state.historicalvalue ? state.historicalvalue.toFixed(2) : 'Нет данных',
        timestamp: new Date(state.last_updated).toLocaleTimeString(),
        status: status,
        statusColor: statusColor,
      }
    })

    const sensorDetails = await Promise.all(sensorDetailsPromises)

    // 4. Формируем финальный ответ
    const overallStatus = sensorDetails.some((s) => s.status === 'Тревога') ? 'Тревога' : 'Активен'
    const overallStatusColor = overallStatus === 'Тревога' ? 'text-danger' : 'text-success'

    const responseData = {
      name: assetName,
      workshop: wsection,
      responsibleEngineer: nameU,
      status: overallStatus,
      statusColor: overallStatusColor,
      // Берем самое последнее показание для сводки
      lastValue: sensorDetails[0]?.currentValue || 'N/A',
      lastTimestamp: sensorDetails[0]?.timestamp || 'N/A',
      sensors: sensorDetails,
    }

    res.status(200).json(responseData)
  } catch (error) {
    console.error('Error fetching asset details:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении деталей актива.' })
  }
})

app.put('/api/config/asset/:assetName', authenticateToken, async (req, res) => {
  const assetName = req.params.assetName
  const newConfigs = req.body // Массив объектов { sensorId, threshold }

  const { access_rights } = req.user

  if (!access_rights || !access_rights.allowedAssets.includes(assetName)) {
    return res.status(403).json({ message: `Инженер не имеет прав на изменение конфигурации актива ${assetName}.` })
  }

  try {
    const operations = newConfigs.map((config) => ({
      updateOne: {
        // Фильтр: ищем по имени актива И ID сенсора
        filter: { asset: assetName, sensorId: config.sensorId },
        // Обновляем или вставляем (upsert: true)
        update: {
          $set: {
            threshold: config.threshold,
            asset: assetName,
          },
        },
        upsert: true,
      },
    }))

    const result = await ThresholdConfigModel.bulkWrite(operations)

    console.log(
      `Thresholds updated for ${assetName}: ${result.modifiedCount} modified, ${result.upsertedCount} upserted.`,
    )
    res.status(200).json({ message: 'Конфигурация порогов обновлена.' })
  } catch (error) {
    console.error('Error bulk updating thresholds:', error)
    res.status(500).json({ message: 'Ошибка сервера при обновлении порогов.' })
  }
})

app.put('/api/assets/:assetName', authenticateToken, async (req, res) => {
  const assetName = req.params.assetName
  const { workshop, responsibleEngineer } = req.body // Данные, которые приходят с фронтенда

  const { access_rights } = req.user

  // 1. Проверка прав: Только инженер может редактировать?
  if (req.user.profession !== 'engineer') {
    return res.status(403).json({ message: 'Редактирование метаданных активов разрешено только инженерам.' })
  }

  // 2. Проверка доступа к этому активу
  if (!access_rights || !access_rights.allowedAssets.includes(assetName)) {
    return res.status(403).json({ message: `У вас нет прав на изменение этого актива: ${assetName}.` })
  }

  try {
    const updateFields = {}
    if (workshop) updateFields.workshop = workshop
    if (responsibleEngineer) updateFields.responsibleEngineer = responsibleEngineer

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'Нет полей для обновления.' })
    }

    const result = await AssetModel.updateOne({ name: assetName }, { $set: updateFields })

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: `Актив ${assetName} не найден.` })
    }

    res.status(200).json({ message: `Актив ${assetName} успешно обновлен.` })
  } catch (error) {
    console.error('Error updating asset metadata:', error)
    res.status(500).json({ message: 'Ошибка сервера при обновлении метаданных актива.' })
  }
})

app.get('/api/user-zone-summary', authenticateToken, async (req, res) => {
  const allowedAssets = req.user.access_rights?.allowedAssets
  const userWorkshop = req.user.wsection

  if (!allowedAssets || allowedAssets.length === 0) {
    // Если у пользователя нет разрешенных активов, возвращаем пустую сводку без ошибки 500
    return res.status(200).json({ summary: [] })
  }

  try {
    // 1. Находим последние показания для ВСЕХ разрешенных активов
    // Используем last_updated, как вы указали
    const currentStates = await SensorCurrentStateModel.find({ asset: { $in: allowedAssets } })
      .sort({ last_updated: -1 }) // Сортируем по полю last_updated
      .lean()

    // 2. Находим конфигурации порогов для этих активов
    const thresholdConfigs = await ThresholdConfigModel.find({ asset: { $in: allowedAssets } }).lean()

    const thresholdsMap = new Map()
    thresholdConfigs.forEach((config) => {
      // Ключ: "ИмяАктива|SensorID"
      thresholdsMap.set(`${config.asset}|${config.sensor_id}`, config.threshold)
    })

    // 3. Агрегируем данные по Активам
    const assetSummary = new Map() // <-- ИСПРАВЛЕНО: Объявлено здесь

    currentStates.forEach((state) => {
      const assetName = state.asset

      if (!assetSummary.has(assetName)) {
        assetSummary.set(assetName, {
          assetName: assetName,
          workshop: userWorkshop,
          totalSensors: 0,
          alarmSensors: 0,
          lastReading: state.historicalvalue ? state.historicalvalue.toFixed(2) : 'N/A',
          lastUpdated: new Date(state.last_updated).toLocaleTimeString(),
        })
      }

      const summary = assetSummary.get(assetName)
      summary.totalSensors++

      const threshold = thresholdsMap.get(`${assetName}|${state.sensor_id}`)

      // Проверка на тревогу
      if (threshold && state.value > threshold) {
        summary.alarmSensors++
      }

      // Обновляем последнюю временную метку (самая последняя запись в currentStates будет самой свежей)
      summary.lastReading = state.historicalvalue ? state.historicalvalue.toFixed(2) : 'N/A'
      summary.lastUpdated = new Date(state.last_updated).toLocaleTimeString()
    })

    // 4. Финализируем статус для каждого актива
    const summaryArray = Array.from(assetSummary.values()).map((summary) => {
      if (summary.alarmSensors > 0) {
        summary.status = 'ТРЕВОГА'
        summary.statusColor = 'text-danger'
      } else if (summary.totalSensors === 0) {
        summary.status = 'Нет данных'
        summary.statusColor = 'text-secondary'
      } else {
        summary.status = 'В норме'
        summary.statusColor = 'text-success'
      }
      return summary
    })

    res.status(200).json({ summary: summaryArray })
  } catch (error) {
    console.error('Error fetching zone summary:', error)
    res.status(500).json({ message: 'Не удалось получить сводку по зонам.' })
  }
})

app.get('/api/historical-data', authenticateToken, async (req, res) => {
  const { asset, sensorId, startDate, endDate } = req.query
  const { allowedAssets } = req.user.access_rights

  if (!asset || !sensorId || !startDate || !endDate) {
    return res.status(400).json({ message: 'Требуются параметры: asset, sensorId, startDate, endDate.' })
  }

  if (!allowedAssets || !allowedAssets.includes(asset)) {
    return res.status(403).json({ message: 'У вас нет доступа к данным этого актива.' })
  }

  try {
    // Используем Date объекты для корректного сравнения с полем типа Date в БД
    const query = {
      asset: asset,
      sensor_id: sensorId,
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    }

    const data = await SensorDataHistory.find(query)
      .select('timestamp historicalvalue') // <-- Используем timestamp и historicalvalue
      .sort({ timestamp: 1 })
      .lean()

    const chartData = data.map((item) => ({
      time: new Date(item.timestamp).toISOString(),
      value: item.historicalvalue, // <-- Используем historicalvalue
    }))

    res.status(200).json({ chartData })
  } catch (error) {
    console.error('Error fetching historical data:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении исторических данных.' })
  }
})

app.get('/api/config/sensor-options', authenticateToken, async (req, res) => {
  const allowedAssets = req.user.access_rights?.allowedAssets

  if (!allowedAssets || allowedAssets.length === 0) {
    return res.status(200).json({ assetSensorMap: {} })
  }

  try {
    // 1. Находим все уникальные пары (asset, sensor_id, sensor_type) для разрешенных активов
    const distinctData = await SensorCurrentStateModel.aggregate([
      { $match: { asset: { $in: allowedAssets } } },
      {
        $group: {
          _id: {
            asset: '$asset',
            sensor_id: '$sensor_id',
            sensor_type: '$sensor_type',
          },
        },
      },
      {
        $project: {
          _id: 0,
          asset: '$_id.asset',
          sensor_id: '$_id.sensor_id',
          sensor_type: '$_id.sensor_type',
        },
      },
    ])

    // 2. Преобразуем результат в Map: { "Asset Name": [{id: "...", type: "..."}] }
    const assetSensorMap = {}

    distinctData.forEach((doc) => {
      if (!assetSensorMap[doc.asset]) {
        assetSensorMap[doc.asset] = []
      }
      assetSensorMap[doc.asset].push({
        id: doc.sensor_id,
        type: doc.sensor_type,
      })
    })

    res.status(200).json({ assetSensorMap })
  } catch (error) {
    console.error('Error fetching sensor options:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении списка сенсоров.' })
  }
})

app.get('/api/current-state-for-asset', authenticateToken, async (req, res) => {
  const { asset } = req.query
  const { allowedAssets } = req.user.access_rights

  if (!asset || !allowedAssets.includes(asset)) {
    return res.status(400).json({ message: 'Неверный актив или нет доступа.' })
  }

  try {
    // Мы ищем в коллекции sensor_current_data
    const currentState = await SensorCurrentStateModel.find({ asset: asset })
      .select('sensor_id value last_updated')
      .sort({ sensor_id: 1 })
      .lean()

    res.status(200).json({ currentState })
  } catch (error) {
    console.error('Error fetching current state:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении текущего состояния.' })
  }
})

app.get('/api/thresholds-by-type', authenticateToken, async (req, res) => {
  try {
    // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Читаем напрямую из ThresholdByTypeModel ---
    const thresholdList = await ThresholdByTypeModel.find({}).lean()

    const thresholdMap = {}
    thresholdList.forEach((item) => {
      // Предполагаем, что в ThresholdByTypeModelSchema поля называются min_value, max_value, sensor_type
      thresholdMap[item.sensor_type] = {
        min_value: item.min_value,
        max_value: item.max_value,
        unit: item.unit,
      }
    })

    res.status(200).json({ thresholdMap })
  } catch (error) {
    console.error('Error fetching thresholds by type:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении порогов по типу.' })
  }
})

app.put('/api/config/thresholds-save', authenticateToken, async (req, res) => {
  // Убедитесь, что только инженеры или администраторы имеют доступ
  if (req.user.profession !== 'engineer' && req.user.profession !== 'admin') {
    return res.status(403).json({ message: 'Доступ запрещен. Только инженеры могут менять настройки.' })
  }

  const updates = req.body // Получаем массив объектов для обновления

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: 'Неверный формат данных.' })
  }

  const bulkOperations = updates
    .map((item) => {
      // Проверяем наличие ключевых полей
      if (!item.sensor_type || item.min_value === undefined || item.max_value === undefined) {
        console.warn('Skipping invalid threshold item:', item)
        return null
      }

      // Операция "найти и обновить, или создать" (upsert)
      return {
        updateOne: {
          // Ищем по sensor_type
          filter: { sensor_type: item.sensor_type },
          // Устанавливаем новые min/max значения
          update: {
            $set: {
              min_value: item.min_value,
              max_value: item.max_value,
              updatedAt: new Date(),
            },
          },
          upsert: true, // Если запись не найдена, она будет создана
        },
      }
    })
    .filter((op) => op !== null) // Отфильтровываем недействительные операции

  if (bulkOperations.length === 0) {
    return res.status(200).json({ message: 'Нет порогов для обновления.' })
  }

  try {
    // Выполняем массовую запись в коллекцию threshold_by_type_config
    const result = await ThresholdByTypeModel.bulkWrite(bulkOperations)

    // ВАЖНО: После обновления threshold_by_type_config,
    // данные на фронтенде будут автоматически обновлены при следующем Polling.

    res.status(200).json({
      message: 'Настройки порогов по типу успешно обновлены.',
      details: result,
    })
  } catch (error) {
    console.error('Error performing bulk update for thresholds:', error)
    res.status(500).json({ message: 'Ошибка сервера при сохранении порогов.' })
  }
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
