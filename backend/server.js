const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')
const { check, validationResult } = require('express-validator')
const schedule = require('node-schedule')
const { Parser } = require('json2csv')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const moment = require('moment')
const path = require('path')
const { type } = require('os')
require('moment/locale/ru')

const app = express()
const port = process.env.PORT || 3001

app.use(
  cors({
    exposedHeaders: ['Content-Disposition'],
  }),
)
app.use(express.json())

app.use(express.static(path.join(__dirname, '..', 'build')))

// --- 1. КОНФИГУРАЦИЯ ДОСТУПА (Справочник активов на основе Цеха) ---
const ASSET_REGISTRY = {
  'Цех №2': ['Двигатель 1', 'Станок 9', 'Насосная Станция'],
  'Поле А': ['Почва поля', 'Теплица', 'Пестицидная'],
  'Цех №1': ['Токарный станок', 'Станок ЧПУ', 'Паровой станок', 'Станок 5'],
}

// соединение с MongoDB
const mongoUri = 'mongodb://127.0.0.1:27017/newdb'

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
  sensor_type: { type: String, required: true },
  min_value: { type: Number, required: true }, // ID Сенсора (напр., "SNSR-0202")
  max_value: { type: Number, required: true }, // Пороговое значение
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

const sensorAlertsSchema = new mongoose.Schema({
  sensor_id: { type: String, required: true },
  alert_type: { type: String, required: true },
  message: { type: String, required: true },
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean },
  resolvedBy: { type: String },
  resolvedAt: { type: Date, default: Date.now },
  wsection: { type: String, required: true },
  asset: { type: String, required: true },
})

sensorAlertsSchema.index(
  { sensor_id: 1, alert_type: 1, resolvedBy: 1 },
  { unique: true, partialFilterExpression: { resolvedBy: { $exists: false } } },
)

const AssetSchema = new mongoose.Schema(
  {
    assetName: { type: String, required: true, unique: true },
    workshop: { type: String, required: true }, // Цех, к которому привязан актив (например, 'Цех №2')
    status: { type: String, default: 'Активен' }, // Статус (Активен/Тревога/В ремонте)
    lastValue: { type: Number },
    lastUpdateTime: { type: Date, default: Date.now },
    responsibleEngineer: { type: String }, // Имя инженера
    sensors: [
      // Список сенсоров, которые привязаны к этому активу (например, ['SNSR-001', 'SNSR-002'])
      {
        sensorId: { type: String, required: true },
        sensorType: { type: String, required: true },
        // В будущем можно хранить здесь их пороговые ID
      },
    ],
  },
  { timestamps: true },
)

// Модель для Истории
const SensorDataHistory = mongoose.model('SensorDataHistory', sensorReadingSchema, 'sensor_data_histories')
/*
 Модель для отчетов
const sensorReportsSchema = mongoose.model('sensorReportsSchema', sensorReportsSchema, 'sensor_reports')
*/

// Модель для оповещений
const SensorAlertModel = mongoose.model('sensorAlertsSchema', sensorAlertsSchema, 'sensor_alerts')

// Модель для Текущего Состояния
const SensorCurrentStateModel = mongoose.model('SensorCurrentState', sensorReadingSchema, 'sensor_current_data')

// Модель для конфигурирования пороговых значений
const ThresholdConfigModel = mongoose.model('ThresholdConfig', ThresholdConfigSchema, 'threshold_config')

const ThresholdByTypeModel = mongoose.model('ThresholdByType', ThresholdByTypeModelSchema, 'threshold_by_type_config')

// Модель для добавления нового датчика
const AssetModel = mongoose.model('Asset', AssetSchema, 'assets')

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

async function isAssetCollectionEmpty() {
  try {
    const count = await AssetModel.estimatedDocumentCount()
    return count === 0
  } catch (e) {
    console.error('Error checking asset collection count:', e)
    return true // В случае ошибки, предполагаем, что она пуста
  }
}

/**
 * Функция генерации тревог: Сравнивает текущие показания с порогами и сохраняет новые записи в БД.
 */
async function generateSensorAlerts() {
  console.log(`[ALERT CHECK] Running alert generation at ${new Date().toLocaleTimeString()}`)

  try {
    // 1. Загружаем пороги
    const thresholds = await ThresholdByTypeModel.find({}).lean()
    const thresholdsMap = new Map(thresholds.map((t) => [t.sensor_type, t]))

    if (thresholdsMap.size === 0) {
      console.log('[ALERT CHECK] No thresholds configured. Skipping.')
      return
    }

    // 2. Загружаем все текущие показания
    const currentReadings = await SensorCurrentStateModel.find({}).lean()
    // Ключ: SensorID-SensorType (для удобного поиска текущего значения)
    const readingsMap = new Map(currentReadings.map((r) => [`${r.sensor_id}-${r.sensor_type}`, r]))

    console.log(`[DEBUG] Thresholds loaded: ${thresholdsMap.size} types configured.`)
    console.log(`[DEBUG] Current readings loaded: ${currentReadings.length} records.`)

    const newAlerts = []
    const resolvedAlertIds = []

    // --- ФАЗА 1: Проверка на создание НОВЫХ тревог ---
    for (const reading of currentReadings) {
      const threshold = thresholdsMap.get(reading.sensor_type)
      if (!threshold) continue

      const value = reading.value
      const sensorId = reading.sensor_id
      const lowerCaseType = reading.sensor_type.toLowerCase()

      let isAlert = false
      let message = ''
      let alert_type = 'GENERAL'
      const min = threshold.min_value
      const max = threshold.max_value

      // ЛОГИКА АКТИВАЦИИ ТРЕВОГИ (Нужно убедиться, что эти типы соответствуют тем, что вы ищете в Фазе 2)
      if (lowerCaseType.includes('давл')) {
        if (value < min || value > max) {
          isAlert = true
          alert_type = value < min ? 'LOW_PRESSURE' : 'HIGH_PRESSURE'
          message =
            value < min
              ? `Давление ниже нормы (${min} ${reading.unit})`
              : `Давление выше нормы (${max} ${reading.unit})`
        }
      } else if (lowerCaseType.includes('температур почв')) {
        if (value < min || value > max) {
          isAlert = true
          alert_type = value < min ? 'LOW_TEMPSOIL' : 'HIGH_TEMPSOIL'
          message =
            value < min
              ? `Температура почвы ниже нормы (${min} ${reading.unit})`
              : `Температура почвы выше нормы (${max} ${reading.unit})`
        }
      } else if (lowerCaseType.includes('кислот')) {
        if (value < min || value > max) {
          isAlert = true
          alert_type = value < min ? 'LOW_ACID' : 'HIGH_ACID'
          message =
            value < min
              ? `Кислотность почвы ниже нормы (${min} ${reading.unit})`
              : `Кислотность почвы выше нормы (${max} ${reading.unit})`
        }
      } else if (
        lowerCaseType.includes('температур') ||
        lowerCaseType.includes('вибрац') ||
        lowerCaseType.includes('влажн') ||
        lowerCaseType.includes('солен') ||
        lowerCaseType.includes('углекисл')
      ) {
        if (value > max) {
          isAlert = true
          alert_type = 'HIGH_VALUE'
          message = `${reading.sensor_type} превысил порог (${max} ${reading.unit})`
        }
      } else if (lowerCaseType.includes('уровня') && value < min) {
        isAlert = true
        alert_type = 'LOW_LEVEL'
        message = `Низкий уровень: ниже ${min} ${reading.unit}`
      }

      if (isAlert) {
        const existingActiveAlert = await SensorAlertModel.findOne({
          sensor_id: sensorId,
          alert_type: alert_type,
          resolvedBy: { $exists: false },
        })

        if (!existingActiveAlert) {
          console.log(`[ALERT HIT] Creating new alert for ${sensorId}: ${message}`)
          newAlerts.push({
            sensor_id: sensorId,
            alert_type: alert_type,
            message: message,
            value: value,
            timestamp: new Date(),
            isRead: false,
            wsection: reading.wsection,
            asset: reading.asset,
          })
        } else {
          console.log(`[ALERT SKIP] Alert type ${alert_type} for ${sensorId} already active.`)
        }
      }
    }

    // Сохраняем новые тревоги
    if (newAlerts.length > 0) {
      await SensorAlertModel.insertMany(newAlerts)
      console.log(`[ALERT CHECK] Successfully created ${newAlerts.length} new alerts.`)
    }

    // --- ФАЗА 2: Проверка на СНЯТИЕ тревог (Normalization Check) ---

    // 1. Находим ВСЕ активные, нерешенные тревоги
    const activeAlerts = await SensorAlertModel.find({ resolvedBy: { $exists: false } }).lean()

    for (const alert of activeAlerts) {
      // Предполагаем, что sensor_type (используемый для чтения) был сохранен в alert.message
      // Но для надежности, лучше использовать sensor_id и посмотреть его текущее состояние

      // Находим ТЕКУЩЕЕ показание для этого сенсора по его ID (используя sensor_type, сохраненный в сообщении, или через отдельный запрос, если это сложно)

      // ПРОСТОЕ ПРЕДПОЛОЖЕНИЕ: Берем текущее показание по sensor_id.
      // Нам нужно знать ТИП сенсора, который вызвал тревогу. Поскольку мы не сохранили sensor_type в alert,
      // мы ищем его в текущих показаниях по sensor_id.

      const currentReadingMatch = currentReadings.find((r) => r.sensor_id === alert.sensor_id)

      if (!currentReadingMatch) continue

      const value = currentReadingMatch.value
      const sensorTypeFromReading = currentReadingMatch.sensor_type

      const threshold = thresholdsMap.get(sensorTypeFromReading)
      if (!threshold) continue

      const min = threshold.min_value
      const max = threshold.max_value

      let shouldResolve = false

      // --- ЛОГИКА СНЯТИЯ ТРЕВОГИ ---

      if (
        alert.alert_type === 'HIGH_VALUE' ||
        alert.alert_type === 'HIGH_ACID' ||
        alert.alert_type === 'HIGH_TEMPSOIL' ||
        alert.alert_type === 'HIGH_PRESSURE'
      ) {
        // Если тревога была вызвана превышением MAX, снимаем, если V <= MAX
        if (value <= max) {
          shouldResolve = true
        }
      } else if (
        alert.alert_type === 'LOW_PRESSURE' ||
        alert.alert_type === 'LOW_ACID' ||
        alert.alert_type === 'LOW_TEMPSOIL' ||
        alert.alert_type === 'LOW_LEVEL'
      ) {
        // Если тревога была вызвана падением MIN, снимаем, если V >= MIN
        if (value >= min) {
          shouldResolve = true
        }
      }
      // Добавить сюда другие типы, если они есть

      if (shouldResolve) {
        resolvedAlertIds.push(alert._id)
        console.log(`[ALERT RESOLVED] Alert ${alert._id} for ${alert.sensor_id} returned to normal range.`)
      }
    }

    // 3. Обновляем решенные тревоги
    if (resolvedAlertIds.length > 0) {
      await SensorAlertModel.updateMany(
        { _id: { $in: resolvedAlertIds } },
        {
          $set: {
            resolvedBy: 'Система Автоматического Мониторинга',
            resolvedAt: new Date(),
          },
        },
      )
      console.log(`[ALERT CHECK] Resolved ${resolvedAlertIds.length} alerts.`)
    }
  } catch (error) {
    console.error('[ALERT CHECK] CRITICAL ERROR during alert generation:', error)
  }
}

// --- Шаг 2: Планирование задачи ---
function startAlertScheduler() {
  // Планируем выполнение каждые 10 секунд
  // В синтаксисе cron (секунда, минута, час, день_месяца, месяц, день_недели)
  // '*/10 * * * * *' означает: каждую 10-ю секунду
  schedule.scheduleJob('*/10 * * * * *', generateSensorAlerts)

  console.log('[SCHEDULER] Alert generation scheduled to run every 10 seconds.')
}

// --- Регистрация ---
app.post(
  '/api/register',
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
app.post('/api/login', async (req, res) => {
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
  if (req.path === '/api/login' || req.path === '/api/register') {
    return next()
  }
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Если нет заголовка Authorization (например, на /sensor-data при первом запросе без токена)
    console.warn(`Unauthorized access attempt on path: ${req.path}`)
    return res.status(401).json({ message: 'Невозможно подключиться. Неверный токен.' })
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
app.get('/api/sensor-data', async (req, res) => {
  try {
    if (!req.user || !req.user.access_rights) {
      return res.status(403).json({ message: 'Access rights missing in token.' })
    }

    const { allowedSections, allowedAssets } = req.user.access_rights
    if (!allowedSections || allowedSections.length === 0 || !allowedAssets || allowedAssets.length === 0) {
      return res.status(403).json({ message: 'User has no access rights defined.' })
    }

    const query = {
      wsection: { $in: allowedSections },
      asset: { $in: allowedAssets },
    }

    const sensorData = await SensorCurrentStateModel.find(query).lean()

    res.status(200).json(sensorData)
  } catch (error) {
    console.error('*** SERVER CRASHED DURING SENSOR DATA FETCH ***', error)
    res.status(500).json({ message: 'Failed to retrieve sensor data' })
  }
})

app.post('/api/assets', authenticateToken, async (req, res) => {
  // Проверка прав доступа
  if (req.user.profession !== 'engineer' && req.user.profession !== 'admin' && req.user.profession !== 'scientist') {
    return res.status(403).json({ message: 'Доступ запрещен. Только инженеры могут создавать активы.' })
  }

  const { assetName, workshop, responsibleWorker } = req.body

  // 2. Дополнительная проверка: Если коллекция пуста, мы разрешаем создание, чтобы инициализировать систему.
  const collectionIsEmpty = await isAssetCollectionEmpty()
  const canCreate = collectionIsEmpty || req.user.access_rights.allowedSections.includes(req.body.workshop)

  if (!canCreate) {
    return res.status(403).json({ message: `Вы не авторизованы для создания активов в цеху "${req.body.workshop}".` })
  }

  if (!assetName || !workshop) {
    return res.status(400).json({ message: 'Имя актива и цех обязательны.' })
  }

  // Дополнительная проверка на соответствие цеха правам доступа (опционально)
  if (!req.user.access_rights.allowedSections.includes(workshop)) {
    return res.status(403).json({ message: `Вы не авторизованы для создания активов в цеху "${workshop}".` })
  }

  try {
    // --- 1. СТАНДАРТНЫЙ НАБОР СЕНСОРОВ ДЛЯ НОВОГО АКТИВА ---
    // Используем очищенное имя для ID сенсоров
    const baseName = assetName.replace(/[^a-zA-Z0-9]/g, '')

    // ----------------------------------------------------

    // Проверяем, существует ли актив с таким именем
    const existingAsset = await AssetModel.findOne({ assetName })
    if (existingAsset) {
      return res.status(400).json({ message: `Актив с именем "${assetName}" уже существует.` })
    }

    const newAsset = new AssetModel({
      assetName,
      workshop,
      responsibleWorker: responsibleWorker || req.user.nameU,
    })

    await newAsset.save()

    // --- 2. ИНИЦИАЛИЗАЦИЯ ДАННЫХ В SensorCurrentState и SensorDataHistory ---
    // Вызываем функцию, которая вставляет начальные записи
    await initializeNewAssetSensors(newAsset, req.user)

    res.status(201).json({ message: 'Актив успешно создан.', asset: newAsset })
  } catch (error) {
    console.error('Error creating new asset:', error)
    // MongoDB duplicate key error (хотя мы уже проверили findOne)
    if (error.code === 11000) {
      return res.status(400).json({ message: `Актив с именем "${assetName}" уже существует (Ошибка БД).` })
    }
    res.status(500).json({ message: 'Ошибка сервера при создании актива.' })
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
  const { access_rights, profession, wsection } = req.user

  // Определяем фильтр для данных сенсоров (SensorCurrentStateModel)
  let sensorFilter = {}
  if (access_rights.allowedAssets && access_rights.allowedAssets.length > 0) {
    sensorFilter.asset = { $in: access_rights.allowedAssets }
  } else if (profession !== 'admin' && wsection) {
    // Для ученых (scientist) фильтруем по цеху, если нет явных прав на активы
    sensorFilter.wsection = { $in: access_rights.allowedSections }
  }

  // Определяем фильтр для тревог
  let alertFilter = {}
  if (access_rights.allowedAssets && access_rights.allowedAssets.length > 0) {
    alertFilter.asset = { $in: access_rights.allowedAssets }
  } else if (profession !== 'admin' && wsection) {
    alertFilter.wsection = { $in: access_rights.allowedSections }
  }
  // Дополнительно фильтруем только активные (не прочитанные и не решенные)
  alertFilter.$and = [{ isRead: false }, { resolvedBy: { $exists: false } }]

  try {
    // 1. Общее количество доступных сенсоров (уникальные sensor_id в пределах разрешенных данных)
    const totalSensorIds = await SensorCurrentStateModel.distinct('sensor_id', sensorFilter)
    const totalSensors = totalSensorIds.length

    // 2. Количество активных (нерешенных/непрочитанных) тревог
    const activeAlertsCount = await SensorAlertModel.countDocuments(alertFilter)

    // 3. Время последнего обновления данных
    const latestReading = await SensorCurrentStateModel.findOne(sensorFilter)
      .sort({ last_updated: -1 })
      .select('last_updated')
      .lean()

    const lastUpdated = latestReading ? latestReading.last_updated : null

    res.status(200).json({
      totalSensors,
      activeAlerts: activeAlertsCount,
      lastUpdated,
    })
  } catch (error) {
    console.error('Error fetching overview stats:', error)
    res.status(500).json({ message: 'Не удалось получить сводную статистику.' })
  }
})

// --- РОУТ СПИСКА (обновленный) ---
app.get('/api/assets-with-live-data', authenticateToken, async (req, res) => {
  if (!req.user || !req.user.access_rights) {
    return res.status(403).json({ message: 'Доступ запрещен: нет данных пользователя.' })
  }

  const { allowedAssets, allowedSections } = req.user.access_rights
  const userWorkshop = req.user.wsection

  try {
    const assetCount = await AssetModel.estimatedDocumentCount()
    let assetsToProcess = []
    let currentStates = []
    let findCurrentStateQuery = {}

    // --- 1. ОПРЕДЕЛЕНИЕ ИСТОЧНИКА ДАННЫХ (AssetModel vs SensorCurrentStateModel) ---

    // A. РЕЖИМ ИНИЦИАЛИЗАЦИИ (AssetModel пуста)
    if (assetCount === 0) {
      console.log('[ASSET FETCH] Initialization Mode: Using SensorCurrentStateModel.')

      // Фильтруем по цеху пользователя, чтобы не показывать лишние данные
      findCurrentStateQuery = { wsection: userWorkshop }

      // Получаем все текущие состояния, соответствующие цеху
      currentStates = await SensorCurrentStateModel.find(findCurrentStateQuery).lean()

      // Группируем их в структуру, похожую на AssetModel
      const groupedAssets = {}
      currentStates.forEach((state) => {
        const assetKey = state.asset
        if (!groupedAssets[assetKey]) {
          groupedAssets[assetKey] = {
            assetName: assetKey,
            workshop: state.wsection,
            sensors: [],
            responsibleEngineer: 'Система',
            // Временные поля для соответствия map ниже
            lastUpdateTime: state.last_updated,
          }
        }
        groupedAssets[assetKey].sensors.push({
          sensorId: state.sensor_id,
          sensorType: state.sensor_type,
        })
      })

      assetsToProcess = Object.values(groupedAssets).map((asset) => ({
        // Форматируем для финального ответа
        name: asset.assetName,
        workshop: asset.workshop,
        sensors: asset.sensors,
        lastUpdateTime: asset.lastUpdateTime,
      }))
    }

    // B. СТРОГИЙ РЕЖИМ (AssetModel - основной источник)
    else {
      console.log('[ASSET FETCH] Strict Mode: Using AssetModel.')

      let findAssetQuery = {}

      if (allowedAssets && allowedAssets.length > 0) {
        findAssetQuery = { assetName: { $in: allowedAssets } }
      } else if (req.user.profession !== 'scientist' && userWorkshop) {
        // Если инженер/админ, но токен пуст, показываем его цех (пока токен не обновится)
        findAssetQuery = { workshop: userWorkshop }
      } else {
        return res.status(200).json([]) // Нет прав или нет цеха
      }

      assetsToProcess = await AssetModel.find(findAssetQuery).lean()

      if (assetsToProcess.length === 0) {
        return res.status(200).json([])
      }

      // Получаем все текущие состояния для сенсоров, привязанных к найденным активам
      const allSensorIds = assetsToProcess.flatMap((asset) => asset.sensors.map((s) => s.sensorId)).filter((id) => id)

      // Если мы в строгом режиме, нам нужно получить данные сенсоров, которые сейчас в БД
      currentStates = await SensorCurrentStateModel.find({ sensor_id: { $in: allSensorIds } }).lean()
    }

    // Если после всех проверок нет активов для обработки
    if (assetsToProcess.length === 0) {
      return res.status(200).json([])
    }

    // --- 2. ОБЩАЯ ЛОГИКА ОБОГАЩЕНИЯ ---

    const stateMap = new Map(currentStates.map((r) => [r.sensor_id, r])) // <-- ИСПРАВЛЕННЫЙ СИНТАКСИС!

    const thresholdsByTypeMap = new Map()
    const thresholdsDb = await ThresholdByTypeModel.find({}).lean()
    thresholdsDb.forEach((t) => thresholdsByTypeMap.set(t.sensor_type, t))

    const results = assetsToProcess.map((asset) => {
      let alarmSensors = 0
      let lastValue = 'N/A'
      let lastTimestamp = 'N/A'

      // Пересчет статуса и поиск последнего показания
      asset.sensors.forEach((sensor) => {
        const state = stateMap.get(sensor.sensorId)

        // Проверка на undefined state и undefined state.value
        if (state && state.value !== undefined) {
          const threshold = thresholdsByTypeMap.get(sensor.sensorType)

          // Расчет тревоги
          if (threshold && state.value > threshold.max_value) {
            alarmSensors++
          }

          // Определение самого свежего показания
          if (new Date(state.last_updated) > new Date(lastTimestamp) || lastTimestamp === 'N/A') {
            lastValue = state.value ? state.value.toFixed(2) : 'N/A'
            lastTimestamp = moment(state.last_updated).format('HH:mm:ss')
          }
        }
      })

      const status = alarmSensors > 0 ? 'Тревога' : 'Активен'
      const statusColor = alarmSensors > 0 ? 'text-danger' : 'text-success'

      return {
        name: asset.assetName || asset.name, // Используем assetName или временное name
        workshop: asset.workshop,
        status: status,
        statusColor: statusColor,
        lastValue: lastValue,
        lastTimestamp: lastTimestamp,
        sensors: asset.sensors, // Возвращаем сенсоры для Генератора Отчетов
      }
    })

    res.status(200).json(results)
  } catch (error) {
    console.error('CRITICAL ERROR in assets-with-live-data:', error)
    res.status(500).json({ message: 'Критическая ошибка сервера при загрузке реестра.' })
  }
})

app.get('/api/assets/:assetName', authenticateToken, async (req, res) => {
  const assetName = req.params.assetName
  const { access_rights, wsection, nameU } = req.user

  if (!access_rights || !access_rights.allowedAssets.includes(assetName)) {
    return res.status(403).json({ message: `Доступ к активу ${assetName} запрещен.` })
  }

  try {
    // 1. Находим пороги для этого актива
    const allThresholdConfigs = await ThresholdByTypeModel.find({}).lean()

    const thresholdsMap = new Map(
      allThresholdConfigs.map((c) => [c.sensor_type, { min: c.min_value, max: c.max_value }]),
    )

    // 2. Находим показания для всех сенсоров этого актива
    const currentStates = await SensorCurrentStateModel.find({ asset: assetName }).sort({ last_updated: -1 }).lean()

    // 3. Агрегируем и обогащаем данные
    const sensorDetailsPromises = currentStates.map(async (state) => {
      const sensorType = state.sensor_type
      const currentThresholds = thresholdsMap.get(sensorType) || {}

      const currentValue = parseFloat(state.value)
      const minValue = parseFloat(currentThresholds.min)
      const maxValue = parseFloat(currentThresholds.max)
      console.log(`[${sensorType}] Value: ${currentValue}, Min: ${minValue}, Max: ${maxValue}`)
      console.log(`Is Alarm: ${currentValue < minValue || currentValue > maxValue}`)

      let status = 'ОК'
      let statusText = 'ОК'

      if (isNaN(currentValue) || isNaN(minValue) || isNaN(maxValue)) {
        status = 'Error'
        statusText = 'Ошибка данных'
      } else if (currentValue < minValue || currentValue > maxValue) {
        status = 'Alarm'
        statusText = 'Тревога'
      }

      let statusColor
      let badgeBg
      if (status === 'Alarm') {
        statusColor = 'text-danger'
        badgeBg = 'bg-danger'
      } else if (status === 'Error') {
        statusColor = 'text-warning' // Желтый цвет для ошибки данных
        badgeBg = 'bg-warning'
      } else {
        statusColor = 'text-success'
        badgeBg = 'bg-success'
      }

      return {
        type: state.sensor_type, // Берем тип из показаний
        sensorId: state.sensor_id,
        min_value: currentThresholds.min,
        max_value: currentThresholds.max,
        unit: state.unit,
        currentValue: state.value ? state.value.toFixed(2) : 'Нет данных',
        timestamp: moment(state.last_updated).format('YYYY-MM-DD HH:mm:ss'),
        status: statusText,
        statusColor: statusColor,
        badgeBg: badgeBg,
      }
    })

    const sensorDetails = await Promise.all(sensorDetailsPromises)

    // 4. Формируем финальный ответ
    const overallStatus = sensorDetails.some((s) => s.status === 'Тревога') ? 'Тревога' : 'Активен'
    const overallStatusColor = overallStatus === 'Тревога' ? 'text-danger' : 'text-success'

    const responseData = {
      name: assetName,
      workshop: wsection,
      responsibleWorker: nameU,
      status: overallStatus,
      statusColor: overallStatusColor,
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
      let latestTimestamp = new Date(state.last_updated)

      if (!assetSummary.has(assetName)) {
        assetSummary.set(assetName, {
          assetName: assetName,
          workshop: userWorkshop,
          totalSensors: 0,
          alarmSensors: 0,
          lastReading: state.value ? state.value.toFixed(2) : 'N/A',
          lastUpdated: latestTimestamp.toLocaleTimeString(),
        })
      }

      const summary = assetSummary.get(assetName)
      summary.totalSensors++

      const threshold = thresholdsMap.get(`${assetName}|${state.sensor_id}`)

      // Проверка на тревогу
      if (threshold && state.value > threshold) {
        summary.alarmSensors++
      }

      // Обновляем последнюю временную метку
      if (new Date(state.last_updated) > new Date(summary.lastUpdated)) {
        summary.lastReading = state.value ? state.value.toFixed(2) : 'N/A'
        summary.lastUpdated = new Date(state.last_updated).toLocaleTimeString()
      }
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
    // ЗАГРУЗКА ПОРОГОВ
    const allThresholdConfigs = await ThresholdByTypeModel.find({}).lean()
    const thresholdsMap = new Map(
      allThresholdConfigs.map((c) => [c.sensor_type, { min: c.min_value, max: c.max_value }]),
    )

    // Запрос данных
    const query = {
      asset: asset,
      sensor_id: sensorId, // Фильтруем по sensorId, который пришел
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    }

    const data = await SensorDataHistory.find(query)
      // Добавляем sensor_type, чтобы знать, какой порог применить
      .select('timestamp historicalvalue sensor_type')
      .sort({ timestamp: 1 })
      .lean()

    // Агрегация и расчет событий
    const chartData = data.map((item) => {
      const rawValue = item.historicalvalue
      const numericValue = parseFloat(rawValue)

      const sensorType = item.sensor_type
      const thresholds = thresholdsMap.get(sensorType) || {}

      const value = parseFloat(item.historicalvalue)
      const minValue = parseFloat(thresholds.min)
      const maxValue = parseFloat(thresholds.max)

      let eventCount = 0

      if (isNaN(value) || isNaN(minValue) || isNaN(maxValue)) {
        console.warn(
          `[Historical Data] Skipping threshold check for ${sensorType} due to NaN: Value=${value}, Min=${thresholds.min}, Max=${thresholds.max}`,
        )
      }

      // Проверка, если значение превысило любой порог
      if (!isNaN(value) && !isNaN(minValue) && !isNaN(maxValue)) {
        if (value < minValue || value > maxValue) {
          eventCount = 1 // Засчитываем одно событие в этой точке
        }
      }

      return {
        time: new Date(item.timestamp).toISOString(),
        value: numericValue,
        eventCount: eventCount,
      }
    })

    res.status(200).json({ chartData })
  } catch (error) {
    console.error('Error fetching historical data:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении исторических данных.' })
  }
})

app.get('/api/config/sensor-options', authenticateToken, async (req, res) => {
  const { allowedAssets, allowedSections } = req.user.access_rights

  if ((!allowedAssets || allowedAssets.length === 0) && (!allowedSections || allowedSections.length === 0)) {
    return res.status(200).json({ assetSensorMap: {} })
  }

  try {
    const matchConditions = []
    // 1. Фильтр по явно разрешенным АКТИВАМ
    if (allowedAssets && allowedAssets.length > 0) {
      matchConditions.push({ asset: { $in: allowedAssets } })
    }

    // 2. Фильтр по разрешенным ЦЕХАМ (на случай, если allowedAssets пуст или для более широкого доступа)
    if (allowedSections && allowedSections.length > 0) {
      matchConditions.push({ wsection: { $in: allowedSections } })
    }

    // 3. Если обе стороны не заданы
    if (matchConditions.length === 0) {
      return res.status(200).json({ assetSensorMap: {} })
    }

    // Находим все уникальные пары (asset, sensor_id, sensor_type) для разрешенных активов
    const distinctData = await SensorCurrentStateModel.aggregate([
      {
        $match: { $or: matchConditions },
      },
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

    // Преобразуем результат в Map: { "Asset Name": [{id: "...", type: "..."}] }
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
    const thresholdList = await ThresholdByTypeModel.find({}).lean()

    const thresholdMap = {}
    thresholdList.forEach((item) => {
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
  if (req.user.profession !== 'engineer' && req.user.profession !== 'admin' && req.user.profession !== 'scientist') {
    return res.status(403).json({ message: 'Доступ запрещен. Только инженеры могут менять настройки.' })
  }

  const updates = req.body

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: 'Неверный формат данных.' })
  }

  const bulkOperations = updates
    .map((item) => {
      if (!item.sensor_type || item.min_value === undefined || item.max_value === undefined) {
        console.warn('Skipping invalid threshold item:', item)
        return null
      }

      return {
        updateOne: {
          filter: { sensor_type: item.sensor_type },
          update: {
            $set: {
              min_value: item.min_value,
              max_value: item.max_value,
              updatedAt: new Date(),
              // NOTE: Мы предполагаем, что unit уже есть в коллекции,
              // если нет, его нужно добавить в PUT-запрос с фронтенда.
            },
          },
          upsert: true,
        },
      }
    })
    .filter((op) => op !== null)

  if (bulkOperations.length === 0) {
    return res.status(200).json({ message: 'Нет порогов для обновления.' })
  }

  try {
    const result = await ThresholdByTypeModel.bulkWrite(bulkOperations)
    res.status(200).json({
      message: 'Настройки порогов по типу успешно обновлены.',
      details: result,
    })
  } catch (error) {
    console.error('Error performing bulk update for thresholds:', error)
    res.status(500).json({ message: 'Ошибка сервера при сохранении порогов.' })
  }
})

// ПОЛУЧЕНИЕ НЕПРОЧИТАННЫХ/АКТИВНЫХ УВЕДОМЛЕНИЙ
app.get('/api/alerts/active', authenticateToken, async (req, res) => {
  try {
    const { allowedSections, allowedAssets } = req.user.access_rights

    // Если прав нет, вернуть 403 или пустой список
    if (!allowedSections || allowedSections.length === 0) {
      return res.status(200).json({ activeAlerts: [], unreadCount: 0 })
    }

    // --- ФИЛЬТРАЦИЯ ТРЕВОГ ПО ПРАВАМ ДОСТУПА ---
    const activeAlerts = await SensorAlertModel.find({
      resolvedBy: { $exists: false }, // Активные = не решенные
      wsection: { $in: allowedSections }, // <-- НОВЫЙ ФИЛЬТР ПО ЦЕХУ ИЗ JWT
    })
      .sort({ timestamp: -1 })
      .limit(50)

    const unreadCount = await SensorAlertModel.countDocuments({
      isRead: false,
      resolvedBy: { $exists: false },
      wsection: { $in: allowedSections }, // <-- НОВЫЙ ФИЛЬТР ДЛЯ СЧЕТЧИКА
    })
    // ------------------------------------------

    res.status(200).json({ activeAlerts, unreadCount })
  } catch (error) {
    console.error('Error fetching active alerts:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении уведомлений.' })
  }
})

app.put('/api/alerts/:id/read', authenticateToken, async (req, res) => {
  try {
    const alert = await SensorAlertModel.findByIdAndUpdate(req.params.id, { $set: { isRead: true } }, { new: true })
    if (!alert) return res.status(404).json({ message: 'Уведомление не найдено.' })
    res.status(200).json({ message: 'Уведомление помечено как прочитанное.', alert })
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера.' })
  }
})

app.put('/api/alerts/:id/resolve', authenticateToken, async (req, res) => {
  const resolvedBy = req.user.nameU || 'администратор'

  try {
    const alert = await SensorAlertModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          resolvedBy: resolvedBy,
          resolvedAt: new Date(),
        },
      },
      { new: true },
    )
    if (!alert) return res.status(404).json({ message: 'Уведомление не найдено.' })
    res.status(200).json({ message: 'Уведомление помечено как решенное.', alert })
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера.' })
  }
})

app.get('/api/alerts/all', authenticateToken, async (req, res) => {
  if (!req.user || !req.user.access_rights) {
    return res.status(403).json({ message: 'Доступ запрещен.' })
  }

  const { allowedAssets, allowedSections } = req.user.access_rights
  const profession = req.user.profession

  let findQuery = {}

  // Строим запрос на основе прав пользователя
  if (profession === 'engineer' || profession === 'scientist') {
    if (allowedSections && allowedSections.length > 0) {
      findQuery = { wsection: { $in: allowedSections } }
    } else {
      // Если прав нет или неизвестная роль, возвращаем пусто
      return res.status(200).json([])
    }
  }

  try {
    // Получаем все уведомления, сортируем по дате (новые сверху)
    const allAlerts = await SensorAlertModel.find(findQuery).sort({ createdAt: -1 }).lean()

    // форматирование даты в 'ru' локаль
    const alertsWithFormattedDate = allAlerts.map((alert) => ({
      ...alert,
      // Форматирование даты
      date_display: moment(alert.createdAt).locale('ru').format('D MMMM YYYY, HH:mm'),
    }))

    res.status(200).json(alertsWithFormattedDate)
  } catch (error) {
    console.error('Error fetching all alerts:', error)
    res.status(500).json({ message: 'Ошибка сервера при получении списка уведомлений.' })
  }
})

// Роут для генерации и скачивания отчетов в формате CSV
app.get('/api/reports/generate', authenticateToken, async (req, res) => {
  // ... (Проверки прав и параметров) ...

  const { reportType, asset, sensorId, startDate, endDate, format: requestedFormat } = req.query
  const format = requestedFormat || 'CSV'

  if (!reportType || !asset || !sensorId || !startDate || !endDate) {
    return res.status(400).json({ message: 'Необходимо указать тип отчета, актив, сенсор, даты и формат.' })
  }

  const start = moment(startDate).startOf('day').toDate()
  const end = moment(endDate).endOf('day').toDate()

  try {
    let reportData = []
    let fields = []

    // --- 1. ПОЛУЧЕНИЕ И ФОРМАТИРОВАНИЕ ДАННЫХ ---
    if (reportType === 'SENSOR_HISTORY') {
      const userWSection = req.user.wsection
      const userProfession = req.user.profession
      let findQuery = {
        asset: asset,
        sensor_id: sensorId,
        timestamp: { $gte: start, $lte: end },
      }

      if (userProfession === 'scientist' || userProfession === 'engineer') {
        // Ученые/Инженеры должны иметь доступ только к данным из своего цеха
        findQuery.wsection = userWSection
      }

      reportData = await SensorDataHistory.find(findQuery).sort({ timestamp: 1 }).lean()

      if (reportData.length === 0) {
        return res.status(404).json({ message: 'Данные для отчета не найдены.' })
      }

      const formattedData = reportData.map((item) => ({
        Время: moment(item.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        Актив: item.asset,
        'Сенсор ID': item.sensor_id,
        'Тип сенсора': item.sensor_type,
        Значение: item.historicalvalue !== null && item.historicalvalue !== undefined ? item.historicalvalue : '',
        Единица: item.unit !== null && item.unit !== undefined ? item.unit : '',
        Цех: item.wsection,
      }))

      fields = ['Время', 'Актив', 'Сенсор ID', 'Тип сенсора', 'Значение', 'Единица', 'Цех']
      reportData = formattedData
    }

    // Объявление tableHeaders на высоком уровне
    const tableHeaders = fields

    // --- 2. ФОРМАТИРОВАНИЕ И ОТПРАВКА ОТЧЕТА ---

    let buffer
    let fileName = `Report_${asset}_${sensorId}_${moment(startDate).format('YYYYMMDD')}_to_${moment(endDate).format(
      'YYYYMMDD',
    )}`

    if (format === 'CSV') {
      // ... (Логика CSV) ...
    } else if (format === 'XLSX') {
      // ... (Логика XLSX) ...
    } else if (format === 'PDF') {
      fileName += '.pdf'
      const doc = new PDFDocument({ margin: 30, size: 'A4' })

      // --- КОНФИГУРАЦИЯ КИРИЛЛИЧЕСКОГО ШРИФТА ---
      const CYRILLIC_FONT_PATH = path.join(__dirname, 'fonts', 'arialmt.ttf')

      try {
        doc.font(CYRILLIC_FONT_PATH)
      } catch (e) {
        console.error('ERROR: Missing Cyrillic font file at:', CYRILLIC_FONT_PATH, e.message)
      }
      // ------------------------------------------

      return new Promise((resolve, reject) => {
        const buffers = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('error', reject)

        doc.on('end', () => {
          // ... (Установка заголовков и отправка PDF) ...
          const pdfBuffer = Buffer.concat(buffers)
          const unencodedFileName = fileName
          const encodedFileName = encodeURIComponent(unencodedFileName)
          const safeAsciiFileName = unencodedFileName.replace(/[^\w\s\.\-]/g, '_')

          res.header('Content-Type', 'application/pdf')
          res.header(
            'Content-Disposition',
            `attachment; filename="${safeAsciiFileName}"; filename*=UTF-8''${encodedFileName}`,
          )
          res.status(200).send(pdfBuffer)
          resolve()
        })

        // --- КОНТЕНТ PDF ---

        doc.fontSize(14).text(`Отчет по активу: ${asset}`, { underline: true })
        doc.fontSize(10).moveDown(0.5)
        doc.text(`Сенсор: ${sensorId}`)
        doc.text(`Период: ${startDate} по ${endDate}`).moveDown(1)

        // --- ПАРАМЕТРЫ ТАБЛИЦЫ ---
        const COLUMN_WIDTHS = [100, 80, 70, 90, 60, 40, 70] // Ширины столбцов
        const TABLE_START_X = 30
        let currentX = TABLE_START_X

        const columnXPositions = COLUMN_WIDTHS.map((width) => {
          const x = currentX
          currentX += width
          return x
        })
        // -------------------------

        doc.fontSize(8)

        // Вывод заголовков
        let startY = doc.y
        tableHeaders.forEach((header, i) => {
          const x = columnXPositions[i]
          doc.text(header, x, startY, { width: COLUMN_WIDTHS[i], align: 'left' })
        })
        doc.moveDown(0.5) // Сдвигаем курсор после заголовков

        // Вывод данных
        reportData.forEach((row) => {
          let y = doc.y // Получаем текущую Y-позицию

          // Переход на новую страницу
          if (y > 750) {
            doc.addPage()
            startY = 30
            y = startY
            doc.fontSize(8)

            // Повторяем заголовки на новой странице
            tableHeaders.forEach((header, i) => {
              const x = columnXPositions[i]
              doc.text(header, x, startY, { width: COLUMN_WIDTHS[i], align: 'left' })
            })
            doc.moveDown(0.5)
            y = doc.y // Обновляем Y после повтора заголовков
          }

          // Вывод текущей строки
          tableHeaders.forEach((header, colIndex) => {
            const x = columnXPositions[colIndex]
            const width = COLUMN_WIDTHS[colIndex]
            const value = String(row[header])

            // Печатаем значение
            doc.text(value, x, y, { width: width, align: 'left', continued: false })
          })

          // Сдвигаем курсор на новую строку для следующей итерации
          doc.moveDown(0.8)
        })

        doc.end()
      })
      return
    } else {
      return res.status(400).json({ message: 'Неподдерживаемый формат отчета.' })
    }

    // ... (Синхронная отправка CSV/XLSX) ...
  } catch (error) {
    console.error('CRITICAL ERROR generating report:', error)
    res.status(500).json({ message: 'Ошибка сервера при генерации отчета.' })
  }
})

async function initializeNewAssetSensors(newAsset, userContext) {
  const assetName = newAsset.assetName
  const workshop = newAsset.workshop
  const timestamp = new Date()

  const initialRecords = newAsset.sensors.map((s) => {
    let unit = 'N/A'

    if (s.sensorType === 'Температура') unit = 'градусов Цельсия'
    else if (s.sensorType === 'Вибрация') unit = 'мм/с'
    else if (s.sensorType === 'Давление') unit = 'бар'

    return {
      sensor_id: s.sensorId,
      timestamp: timestamp,
      last_updated: timestamp,
      sensor_type: s.sensorType,
      role: userContext.profession,
      wsection: workshop,
      asset: assetName,
      value: 20, // Начальное тестовое значение
      unit: unit,
    }
  })

  if (initialRecords.length > 0) {
    // 1. Вставляем в текущее состояние
    await SensorCurrentStateModel.insertMany(initialRecords)
    // 2. Вставляем в историю (для графиков и отчетов)
    await SensorDataHistory.insertMany(initialRecords)
    console.log(`[INIT] Initialized ${initialRecords.length} sensors for new asset: ${assetName}`)
  }
}

app.get('/api/workshops', authenticateToken, async (req, res) => {
  try {
    const assetCount = await AssetModel.estimatedDocumentCount()
    let uniqueWorkshops

    if (assetCount > 0) {
      // Если есть созданные активы, используем их (основной источник)
      uniqueWorkshops = await AssetModel.distinct('workshop')
    } else {
      // Если AssetModel пуста, берем цеха из текущих данных (для инициализации)
      uniqueWorkshops = await SensorCurrentStateModel.distinct('wsection')
      console.log(`[WORKSHOPS INIT] Using SensorCurrentStateModel for workshops: ${uniqueWorkshops.join(', ')}`)
    }

    // Фильтруем цеха по правам доступа пользователя (если у него есть allowedSections)
    const allowed = req.user.access_rights.allowedSections || []
    const filteredWorkshops = uniqueWorkshops.filter((w) => allowed.includes(w))

    res.status(200).json({ workshops: filteredWorkshops })
  } catch (error) {
    console.error('Error fetching workshops:', error)
    res.status(500).json({ workshops: [] })
  }
})

app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, '..', 'build', 'index.html'))
  } else {
    // Если это не GET-запрос (например, POST, PUT, DELETE),
    // и он не был обработан ранее, это означает, что для него нет роута.
    // Это будет 404 Not Found.
    next()
  }
})

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack)
  res.status(500).json({ message: 'Internal Server Error', error: err.message })
})

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB')
    startAlertScheduler() // <-- Запуск планировщика после подключения

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`)
    })
  })
  .catch((err) => console.error('MongoDB connection error:', err))
