import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'

const ThresholdConfigEditor = ({ assetName, token, onClose, initialConfigs }) => {
  // Configs теперь хранит { sensor_type, min_value, max_value }
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (initialConfigs) {
      // ПРЕОБРАЗОВАНИЕ СТАРЫХ ДАННЫХ В НОВЫЙ ФОРМАТ (для совместимости):
      const cleanConfigs = initialConfigs.map((config) => ({
        ...config,
        // Если приходит старое поле 'threshold', используем его для max, иначе берем min_value/max_value
        min_value: parseFloat(config.min_value || 0),
        max_value: parseFloat(config.max_value || config.threshold || 0),
        // Убедимся, что у нас есть тип
        sensor_type: config.sensor_type || config.type,
      }))

      // Группируем, чтобы редактировать только уникальные типы (если это компонент для порогов по типу)
      // Если это компонент для порогов по ID, то оставим так:
      setConfigs(cleanConfigs)
    }
  }, [initialConfigs])

  // Обработчик изменения минимального порога
  const handleMinThresholdChange = (sensorId, newMinThreshold) => {
    setConfigs((prevConfigs) =>
      prevConfigs.map((config) =>
        config.sensorId === sensorId ? { ...config, min_value: parseFloat(newMinThreshold) } : config,
      ),
    )
  }

  // Обработчик изменения максимального порога
  const handleMaxThresholdChange = (sensorId, newMaxThreshold) => {
    setConfigs((prevConfigs) =>
      prevConfigs.map((config) =>
        config.sensorId === sensorId ? { ...config, max_value: parseFloat(newMaxThreshold) } : config,
      ),
    )
  }

  // --- ОТПРАВКА НА БЭКЕНД ---
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    // Если мы редактируем пороги по типу (единые для всех),
    // нам нужно отправить только список уникальных типов.
    // Если мы редактируем пороги по ID сенсора, отправляем все configs.

    // В данном случае, так как это редактор для Актива (assetName), мы, вероятно,
    // редактируем пороги *для каждого сенсора* в этом активе.

    // НО ТАК КАК ВЫ ДОЛЖНЫ ПЕРЕЙТИ НА СХЕМУ ПО ТИПУ, мы должны отправить:
    // 1. Либо запрос на сохранение *всех* порогов по типу.
    // 2. Либо запрос на обновление *этих* конкретных сенсоров.

    // Предлагаем отправить на бэкенд массив с { sensor_type, min_value, max_value }
    const thresholdsToSave = configs.map((c) => ({
      sensor_type: c.sensor_type || c.type, // Ключ для БД
      min_value: c.min_value,
      max_value: c.max_value,
    }))

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }

      // ВАЖНО: Мы меняем API-эндпоинт на тот, который сохраняет новую структуру.
      // PUT /api/config/type/save (или что-то подобное, что обновит threshold_by_type_config)
      const response = await axios.put(`${API_BASE_URL}/api/config/thresholds-save`, thresholdsToSave, config)

      setMessage('Конфигурация порогов успешно обновлена!')
      setTimeout(() => onClose(true), 1000)
    } catch (err) {
      console.error('Error saving thresholds:', err)
      setError('Ошибка при сохранении конфигурации. Проверьте, что бэкенд принимает новый формат: min_value/max_value.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='modal-backdrop show d-block'>
      <div
        className='modal fade show'
        style={{ display: 'block' }}
        tabIndex='-1'
      >
        <div className='modal-dialog modal-lg'>
          <div className='modal-content'>
            <form onSubmit={handleSubmit}>
              <div className='modal-header bg-warning text-dark'>
                <h5 className='modal-title'>Редактирование Порогов для Актива: {assetName}</h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => onClose(false)}
                  aria-label='Close'
                ></button>
              </div>
              <div className='modal-body'>
                {error && <div className='alert alert-danger'>{error}</div>}
                {message && <div className='alert alert-success'>{message}</div>}

                <p>Настройте пороговые значения (min/max) для определения статуса "Тревога".</p>

                {configs.length === 0 && <div className='alert alert-info'>Нет данных о сенсорах для настройки.</div>}

                {configs.map((config) => (
                  <div
                    key={config.sensorId}
                    className='mb-3 p-2 border rounded d-flex align-items-center'
                  >
                    <div className='flex-grow-1 me-3'>
                      <strong>{config.sensor_type || config.type || config.sensorId}</strong> (ID: {config.sensorId})
                    </div>

                    {/* --- МИНИМАЛЬНЫЙ ПОРОГ --- */}
                    <label
                      htmlFor={`min-threshold-${config.sensorId}`}
                      className='me-2'
                    >
                      Минимальный порог:
                    </label>
                    <input
                      id={`min-threshold-${config.sensorId}`}
                      type='number'
                      step='0.01'
                      value={config.min_value} // <-- ПРИВЯЗАНО К НОВОМУ ПОЛЮ
                      onChange={(e) => handleMinThresholdChange(config.sensorId, e.target.value)}
                      className='form-control w-25'
                      required
                    />

                    {/* --- МАКСИМАЛЬНЫЙ ПОРОГ --- */}
                    <label
                      htmlFor={`max-threshold-${config.sensorId}`}
                      className='me-2 ms-3'
                    >
                      Максимальный порог:
                    </label>
                    <input
                      id={`max-threshold-${config.sensorId}`}
                      type='number'
                      step='0.01'
                      value={config.max_value} // <-- ПРИВЯЗАНО К НОВОМУ ПОЛЮ
                      onChange={(e) => handleMaxThresholdChange(config.sensorId, e.target.value)}
                      className='form-control w-25'
                      required
                    />
                  </div>
                ))}
              </div>
              <div className='modal-footer'>
                <button
                  type='button'
                  className='btn btn-secondary'
                  onClick={() => onClose(false)}
                  disabled={loading}
                >
                  Закрыть
                </button>
                <button
                  type='submit'
                  className='btn btn-primary'
                  disabled={loading || configs.length === 0}
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThresholdConfigEditor
