import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'

const ThresholdConfigEditor = ({ assetName, token, onClose, initialConfigs }) => {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (initialConfigs) {
      // Преобразуем "N/A" в 0 или null для поля ввода числа
      const cleanConfigs = initialConfigs.map((config) => ({
        ...config,
        threshold: config.threshold === 'N/A' || config.threshold === null ? 0 : config.threshold,
      }))
      setConfigs(cleanConfigs)
    }
  }, [initialConfigs])

  const handleThresholdChange = (sensorId, newThreshold) => {
    setConfigs((prevConfigs) =>
      prevConfigs.map((config) =>
        config.sensorId === sensorId ? { ...config, threshold: parseFloat(newThreshold) } : config,
      ),
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }

      const response = await axios.put(`${API_BASE_URL}/api/config/asset/${assetName}`, configs, config)

      setMessage('Конфигурация порогов успешно обновлена!')
      // Даем пользователю увидеть сообщение об успехе, прежде чем закрыть
      setTimeout(() => onClose(true), 1000)
    } catch (err) {
      console.error('Error saving thresholds:', err)
      setError('Ошибка при сохранении конфигурации. Проверьте права доступа.')
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

                <p>Настройте пороговые значения для определения статуса "Тревога".</p>

                {configs.length === 0 && <div className='alert alert-info'>Нет данных о сенсорах для настройки.</div>}

                {configs.map((config) => (
                  <div
                    key={config.sensorId}
                    className='mb-3 p-2 border rounded d-flex align-items-center'
                  >
                    <div className='flex-grow-1 me-3'>
                      <strong>{config.type || config.sensorId}</strong> (ID: {config.sensorId})
                    </div>
                    <label
                      htmlFor={`threshold-${config.sensorId}`}
                      className='me-2'
                    >
                      Порог:
                    </label>
                    <input
                      id={`threshold-${config.sensorId}`}
                      type='number'
                      step='0.01'
                      value={config.threshold}
                      onChange={(e) => handleThresholdChange(config.sensorId, e.target.value)}
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
