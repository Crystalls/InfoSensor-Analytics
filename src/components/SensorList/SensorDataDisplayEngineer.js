// SensorDataDisplay.js
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api' // Assuming you have an API base URL
import AlertValue from '../AlertList/AlertList' // Предполагаем, что AlertValue умеет подсвечивать ошибки
import '../SensorList/SensorList.css'

function SensorDataDisplayEngineer() {
  const [sensorData, setSensorData] = useState([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const temperatureThreshold = 45
  const humidityThreshold = 65
  const minPascalThreshold = 0.7
  const maxPascalThreshold = 3.5

  // Вспомогательная функция для определения, есть ли ошибка
  const checkSensorError = (sensor) => {
    // !!! ЗАЩИТА: Проверяем наличие sensor_type перед вызовом toLowerCase() !!!
    if (!sensor || !sensor.sensor_type || typeof sensor.sensor_type !== 'string') {
      console.warn('Invalid sensor object or missing sensor_type:', sensor)
      // Если тип неизвестен, считаем, что ошибки нет (или возвращаем false)
      return false
    }
    const lowerCaseType = sensor.sensor_type.toLowerCase()

    if (lowerCaseType.includes('температур')) {
      return sensor.value > temperatureThreshold
    } else if (lowerCaseType.includes('влажн')) {
      return sensor.value > humidityThreshold
    } else if (lowerCaseType.includes('давл')) {
      return sensor.value < minPascalThreshold || sensor.value > maxPascalThreshold
    }
    return false
  }

  // Функция для получения сообщения об ошибке (для title индикатора !)
  const getAlertMessage = (sensor) => {
    if (!sensor || !sensor.sensor_type) return ''
    const lowerCaseType = sensor.sensor_type.toLowerCase()
    const value = sensor.value

    if (lowerCaseType.includes('температур')) {
      if (value > temperatureThreshold) return `Превышены пороговые значения температуры (${temperatureThreshold} °C)`
    } else if (lowerCaseType.includes('влажн')) {
      if (value > humidityThreshold) return `Превышены пороговые значения влажности (${humidityThreshold} %)`
    } else if (lowerCaseType.includes('давл')) {
      if (value < minPascalThreshold) return `Давление ниже порогового значения (${minPascalThreshold} Па)`
      if (value > maxPascalThreshold) return `Превышены пороговые значения давления (${maxPascalThreshold} Па)`
    }
    return ''
  }

  // !!! ОПРЕДЕЛЕНИЕ ФУНКЦИИ !!!
  // Функция для получения основного порогового значения для AlertValue
  const getAlertThresholdForAlertValue = (sensor) => {
    if (!sensor || !sensor.sensor_type) return 200
    const lowerCaseType = sensor.sensor_type.toLowerCase()
    if (lowerCaseType.includes('температур')) {
      return temperatureThreshold
    } else if (lowerCaseType.includes('влажн')) {
      return humidityThreshold
    } else if (lowerCaseType.toLowerCase().includes('давл')) {
      // Для датчиков давления, передаем объект диапазона
      return { min: minPascalThreshold, max: maxPascalThreshold }
    }
    return 200 // Default threshold for unknown types
  }

  useEffect(() => {
    const fetchSensorData = async () => {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setError('No token found. Please log in.')
          return
        }

        const response = await axios.get(`${API_BASE_URL}/sensor-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const formattedData = response.data.map((data) => ({
          ...data,
          isExpanded: false,
          hasError: checkSensorError(data),
        }))
        setSensorData(formattedData)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch sensor data')
        console.error('Error fetching sensor data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSensorData()
  }, []) // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании

  const toggleExpand = (sensorId) => {
    setSensorData((prevData) =>
      prevData.map((data) => (data.sensor_id === sensorId ? { ...data, isExpanded: !data.isExpanded } : data)),
    )
  }

  if (isLoading) {
    return <p>Loading sensor data...</p>
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>
  }

  return (
    <div className='flex_sensor_container'>
      <div className='sensor_container'>
        <div className='text_sensors'>
          <h2>
            Sensor <br></br> Data
          </h2>
        </div>
        <div>
          {' '}
          {/* Этот div будет второй колонкой в grid */}
          {sensorData.length > 0 ? (
            <ul>
              {sensorData.map((data) => {
                const alertMessage = getAlertMessage(data)
                // Получаем порог или диапазон для AlertValue
                const alertThresholdOrRange = getAlertThresholdForAlertValue(data)

                return (
                  <div
                    key={data._id}
                    className={`
                      container_data
                      ${data.isExpanded ? 'expanded' : ''}
                      ${data.hasError ? 'sensor-error' : ''}
                    `}
                  >
                    <li className='sensor-item'>
                      <div
                        className='sensor-header'
                        onClick={() => toggleExpand(data.sensor_id)}
                      >
                        <h1 className='title'>
                          ID Датчика: {data.sensor_id}
                          <br></br>
                          Локация датчика: {data.wsection}
                        </h1>
                        {data.hasError && (
                          <span
                            className='error-indicator'
                            title={alertMessage} // Отображаем полное сообщение ошибки при наведении
                          >
                            !
                          </span>
                        )}
                        <span className={`arrow ${data.isExpanded ? 'up' : 'down'}`}></span>
                      </div>

                      {data.isExpanded && (
                        <div className='sensor-details'>
                          Тип датчика: {data.sensor_type.toLowerCase()}
                          <br></br>
                          <div className='data_info'>
                            Показатели:
                            <AlertValue
                              sensorType={data.sensor_type}
                              value={data.value}
                              // Передаем порог или диапазон для AlertValue
                              alertThreshold={alertThresholdOrRange}
                              // Передаем сформированное сообщение об ошибке
                              alertMessage={alertMessage}
                              unit={data.unit}
                            />
                          </div>
                          Дата замера: {new Date(data.timestamp).toLocaleString()}
                        </div>
                      )}
                    </li>
                  </div>
                )
              })}
            </ul>
          ) : (
            <p>No sensor data available.</p>
          )}
        </div>{' '}
        {/* Конец второй колонки grid */}
      </div>
    </div>
  )
}

export default SensorDataDisplayEngineer
