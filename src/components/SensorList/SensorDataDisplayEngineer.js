import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api' // Убедитесь, что путь правильный
import AlertValue from '../AlertList/AlertList'
import '../SensorList/SensorList.css'

function SensorDataDisplayEngineer() {
  // sensorData: Полный массив данных (используется для хранения всех полученных данных, в т.ч. для деталей при раскрытии)
  const [sensorData, setSensorData] = useState([])
  // groupedData: Сгруппированные данные (Цех -> Актив -> Список датчиков), отображает ЛИШЬ ПОСЛЕДНЕЕ значение
  const [groupedData, setGroupedData] = useState({})
  // expandedItems: Управляет раскрытием Asset (объектов) и Sensor Details (деталей датчиков)
  const [expandedItems, setExpandedItems] = useState({})
  const [isLoading, setLoading] = useState(true) // Флаг загрузки для первоначальной загрузки
  const [error, setError] = useState('')

  // --- ПОРОГИ ДЛЯ ОПОВЕЩЕНИЙ ---
  const temperatureThreshold = 45
  const humidityThreshold = 65
  const minPascalThreshold = 0.7
  const maxPascalThreshold = 3.5
  const minCountThreshold = 600
  // -----------------------------

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (для проверки ошибок и сообщений) ---

  // Функция проверки, имеет ли датчик ошибку
  const checkSensorError = useCallback(
    (sensor) => {
      // Строгая защита от некорректных данных
      if (!sensor || !sensor.sensor_type || typeof sensor.sensor_type !== 'string' || sensor.value === undefined) {
        return false
      }
      const lowerCaseType = sensor.sensor_type.toLowerCase()

      if (lowerCaseType.includes('температур')) {
        return sensor.value > temperatureThreshold
      } else if (lowerCaseType.includes('влажн')) {
        return sensor.value > humidityThreshold
      } else if (lowerCaseType.includes('уровня')) {
        return sensor.value < minCountThreshold
      } else if (lowerCaseType.includes('давл')) {
        return sensor.value < minPascalThreshold || sensor.value > maxPascalThreshold
      }
      return false
    },
    [temperatureThreshold, humidityThreshold, minPascalThreshold, maxPascalThreshold],
  )

  // Функция получения сообщения об ошибке
  const getAlertMessage = useCallback(
    (sensor) => {
      if (!sensor || !sensor.sensor_type || sensor.value === undefined) return ''
      const lowerCaseType = sensor.sensor_type.toLowerCase()
      const value = sensor.value

      if (lowerCaseType.includes('температур') && value > temperatureThreshold)
        return `Превышены пороговые значения температуры (${temperatureThreshold} °C)`
      if (lowerCaseType.includes('уровня') && value < minCountThreshold)
        return `Низкий уровень жидкости (${temperatureThreshold} мл)`
      if (lowerCaseType.includes('влажн') && value > humidityThreshold)
        return `Превышены пороговые значения влажности (${humidityThreshold} %)`
      if (lowerCaseType.includes('давл')) {
        if (value < minPascalThreshold) return `Давление ниже порогового значения (${minPascalThreshold} Па)`
        if (value > maxPascalThreshold) return `Превышены пороговые значения давления (${maxPascalThreshold} Па)`
      }
      return ''
    },
    [temperatureThreshold, humidityThreshold, minPascalThreshold, maxPascalThreshold],
  )

  // Функция получения порогов для отображения в AlertValue
  const getAlertThresholdForAlertValue = useCallback(
    (sensor) => {
      if (!sensor || !sensor.sensor_type) return 200
      const lowerCaseType = sensor.sensor_type.toLowerCase()
      if (lowerCaseType.includes('температур')) return temperatureThreshold
      if (lowerCaseType.includes('уровня')) return minCountThreshold
      if (lowerCaseType.includes('влажн')) return humidityThreshold
      if (lowerCaseType.includes('давл')) {
        return { min: minPascalThreshold, max: maxPascalThreshold }
      }
      return 200
    },
    [temperatureThreshold, humidityThreshold, minPascalThreshold, maxPascalThreshold],
  )

  // --- ФУНКЦИЯ ГРУППИРОВКИ ДАННЫХ ---
  // Группирует данные по Цеху -> Активу. Предполагается, что dataArray содержит уже ЛИШНИЕ показания (если бэкенд не дублирует).
  const groupDataByAsset = (dataArray) => {
    const grouped = {}
    dataArray.forEach((sensor) => {
      const section = sensor.wsection
      const asset = sensor.asset

      if (!section || !asset) return // Пропускаем записи без цеха или объекта

      if (!grouped[section]) grouped[section] = {}
      if (!grouped[section][asset]) grouped[section][asset] = []

      grouped[section][asset].push(sensor)
    })
    return grouped
  }

  // --- ЕДИНЫЙ ОБРАБОТЧИК РАСКРЫТИЯ (для Asset и Sensor Details) ---
  const toggleItemExpand = (level, sectionName, assetName, sensorId) => {
    setExpandedItems((prev) => {
      const newPrev = { ...prev }

      if (level === 'ASSET') {
        // Раскрытие/Скрытие Объекта (Asset)
        newPrev[sectionName] = {
          ...newPrev[sectionName],
          [assetName]: !newPrev[sectionName]?.[assetName],
        }
      } else if (level === 'SENSOR' && sensorId) {
        // Раскрытие/Скрытие Деталей Датчика
        newPrev[sectionName] = {
          ...newPrev[sectionName],
          [assetName]: {
            ...newPrev[sectionName]?.[assetName],
            [sensorId]: !newPrev[sectionName]?.[assetName]?.[sensorId],
          },
        }
      }
      return newPrev
    })
  }

  // --- ЗАГРУЗКА ДАННЫХ С POLLING ---

  // useCallback используется для мемоизации функции, чтобы избежать ее пересоздания
  // при каждом рендере, что важно для useEffect с интервалом.
  const fetchSensorData = useCallback(async () => {
    // Если это первая загрузка, мы хотим показать индикатор загрузки.
    // Для последующих обновлений, индикатор не нужен, чтобы не мигать интерфейсом.
    const isInitialLoad = isLoading
    if (!isInitialLoad) {
      // Можно показать индикатор загрузки или просто ничего не делать,
      // чтобы обновление было плавным.
      // setLoading(true); // Раскомментируйте, если хотите видеть индикатор обновления
    }

    setError('') // Сбрасываем ошибку при каждой попытке получения данных
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('Authentication token is missing')

      // *** ВАЖНО: Убедитесь, что ваш Node.js API на /sensor-data
      // *** возвращает данные из нужной коллекции (current_data)
      const response = await axios.get(`${API_BASE_URL}/sensor-data`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // 1. Фильтрация данных: удаляем записи без нужных полей
      const initialData = response.data.filter(
        (data) => data && data.sensor_type && data.wsection && data.asset && data.value !== undefined,
      )

      // 2. Добавляем флаги ошибок и состояние раскрытия деталей (isExpanded)
      // isExpanded сбрасывается при каждом обновлении, если оно не управляется глобально.
      // В этой реализации, isExpanded управляется в expandedItems.
      const dataWithErrorFlags = initialData.map((data) => ({
        ...data,
        isExpanded: false, // Флаг isExpanded теперь будет браться из expandedItems
        hasError: checkSensorError(data),
      }))

      setSensorData(dataWithErrorFlags) // Сохраняем полный набор данных (для истории/деталей)

      // 3. Группируем данные по Цеху -> Активу
      // Предполагается, что ваш API возвращает только последние значения,
      // поэтому здесь нет шага сжатия (getLatestReadings).
      const groups = groupDataByAsset(dataWithErrorFlags)
      setGroupedData(groups)
    } catch (err) {
      // Ловим ошибки сети или ответа сервера
      setError(err.response?.data?.message || 'Failed to fetch sensor data')
      console.error('Error fetching sensor data:', err)
    } finally {
      // Если это была первая загрузка, скрываем индикатор загрузки
      if (isInitialLoad) {
        setLoading(false)
      } else {
        // Если это было обновление, скрываем индикатор обновления (если он показывался)
        setLoading(false)
      }
    }
  }, [isLoading, checkSensorError]) // Зависимости: isLoading, checkSensorError

  // --- Настройка Polling (Периодическое обновление) ---
  useEffect(() => {
    // 1. Выполняем первый запрос сразу после монтирования компонента
    fetchSensorData()

    // 2. Настраиваем интервал для периодического опроса
    const intervalId = setInterval(() => {
      console.log('Polling for new data...') // Для отладки
      fetchSensorData()
    }, 5000) // Интервал обновления: 5000 миллисекунд = 5 секунд

    // 3. Очистка интервала при размонтировании компонента
    // Это предотвращает утечку памяти и выполнение запросов после удаления компонента
    return () => clearInterval(intervalId)
  }, [fetchSensorData]) // fetchSensorData обновляется только при изменении isLoading или checkSensorError

  // --- РЕНДЕРИНГ КОМПОНЕНТА ---

  // Показываем индикатор загрузки только при первой загрузке
  if (isLoading && Object.keys(groupedData).length === 0) {
    return <p>Loading sensor data...</p>
  }

  // Если произошла ошибка
  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>
  }

  // Основной рендеринг данных
  return (
    <div className='flex_sensor_container'>
      <div className='sensor_container'>
        <div className='text_sensors'>
          <h2>
            Sensor <br /> Data
          </h2>
        </div>
        <div>
          {/* Проверяем, есть ли данные для отображения */}
          {Object.keys(groupedData).length > 0 ? (
            <div className='hierarchical-dashboard'>
              {/* Итерация по ЦЕХАМ (WSection) */}
              {Object.keys(groupedData).map((sectionName) => (
                <div
                  key={sectionName}
                  className='section-block'
                >
                  <h3
                    onClick={() => toggleItemExpand('ASSET', sectionName, null)}
                    style={{ cursor: 'pointer' }}
                  >
                    Цех: {sectionName}
                  </h3>

                  {/* Итерация по ОБЪЕКТАМ/АСCЕТАМ внутри Цеха */}
                  {Object.keys(groupedData[sectionName]).map((assetName) => (
                    <div
                      key={assetName}
                      className='asset-block'
                    >
                      {/* Заголовок Объекта (Asset) */}
                      <div
                        className='asset-header'
                        onClick={() => toggleItemExpand('ASSET', sectionName, assetName, null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <h4>Объект: {assetName}</h4>
                        {/* Иконка раскрытия/свертывания */}
                        <span className={`arrow ${expandedItems[sectionName]?.[assetName] ? 'up' : 'down'}`}></span>
                      </div>

                      {/* Контент Объекта (Asset), если он раскрыт */}
                      {expandedItems[sectionName]?.[assetName] && (
                        <div className='sensor-list-container'>
                          {/* Итерация по ДАТЧИКАМ (последние показания для этого объекта) */}
                          {groupedData[sectionName][assetName].map((data) => {
                            // Получаем сообщения и пороги для текущего датчика
                            const alertMessage = getAlertMessage(data)
                            const alertThresholdOrRange = getAlertThresholdForAlertValue(data)

                            // Определяем, раскрыты ли детали этого датчика, основываясь на состоянии expandedItems
                            const isDetailExpanded = expandedItems[sectionName]?.[assetName]?.[data.sensor_id]

                            return (
                              <div
                                // Уникальный ключ для каждого элемента датчика
                                key={data.sensor_id + data.timestamp}
                                className={`
                                                                    container_data
                                                                    ${
                                                                      isDetailExpanded ? 'expanded' : ''
                                                                    } {/* Класс для раскрытого состояния */}
                                                                    ${
                                                                      data.hasError ? 'sensor-error' : ''
                                                                    } {/* Класс для ошибки */}
                                                                `}
                              >
                                <li className='sensor-item'>
                                  {/* Заголовок Датчика (Sensor Header) */}
                                  <div
                                    className='sensor-header'
                                    onClick={() => toggleItemExpand('SENSOR', sectionName, assetName, data.sensor_id)}
                                  >
                                    <h1 className='title'>
                                      ID Датчика: {data.sensor_id}
                                      <br></br>
                                      Тип: {data.sensor_type}
                                    </h1>
                                    {/* Индикатор ошибки, если есть */}
                                    {data.hasError && (
                                      <span
                                        className='error-indicator'
                                        title={alertMessage}
                                      >
                                        !
                                      </span>
                                    )}
                                    {/* Иконка раскрытия/свертывания деталей */}
                                    <span className={`arrow ${isDetailExpanded ? 'up' : 'down'}`}></span>
                                  </div>

                                  {/* Детали Датчика (Sensor Details), если раскрыты */}
                                  {isDetailExpanded && (
                                    <div className='sensor-details'>
                                      Тип: {data.sensor_type.toLowerCase()}
                                      <br></br>
                                      <div className='data_info'>
                                        Показатели:
                                        {/* Компонент AlertValue для отображения показаний */}
                                        <AlertValue
                                          sensorType={data.sensor_type}
                                          value={data.value}
                                          alertThreshold={alertThresholdOrRange}
                                          alertMessage={alertMessage}
                                          unit={data.unit}
                                        />
                                      </div>
                                      Дата замера: {new Date(data.last_updated).toLocaleString()}
                                    </div>
                                  )}
                                </li>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            // Сообщение, если данных нет
            <p>No sensor data available for your access level.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default SensorDataDisplayEngineer
