import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'
import moment from 'moment'

const ReportGenerator = ({ user, token }) => {
  const today = moment().format('YYYY-MM-DD')
  const oneMonthAgo = moment().subtract(1, 'month').format('YYYY-MM-DD')

  const [reportFormat, setReportFormat] = useState('CSV')

  const [assets, setAssets] = useState([])
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(false)

  // Параметры отчета
  const [reportType, setReportType] = useState('SENSOR_HISTORY')
  const [selectedAsset, setSelectedAsset] = useState('')
  const [selectedSensor, setSelectedSensor] = useState('')
  const [startDate, setStartDate] = useState(oneMonthAgo)
  const [endDate, setEndDate] = useState(today)

  // 1. Загрузка фильтров (активы и сенсоры)
  const fetchOptions = useCallback(async () => {
    if (!token) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      // Используем роут, который возвращает активы, доступные пользователю
      const response = await axios.get(`${API_BASE_URL}/api/assets-with-live-data`, config)

      // Предполагаем, что response.data - это массив активов
      const availableAssets = response.data.map((a) => ({ name: a.name, sensors: a.sensors || [] }))

      setAssets(availableAssets)

      if (availableAssets.length > 0) {
        const initialAsset = availableAssets[0]
        setSelectedAsset(initialAsset.name)
        setSensors(initialAsset.sensors)
        if (initialAsset.sensors.length > 0) {
          setSelectedSensor(initialAsset.sensors[0].sensorId)
        }
      }
    } catch (error) {
      console.error('Failed to load report options:', error)
    }
  }, [token])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  // Обновление списка сенсоров при смене актива
  useEffect(() => {
    const asset = assets.find((a) => a.name === selectedAsset)
    if (asset) {
      setSensors(asset.sensors || [])
      if (asset.sensors.length > 0) {
        setSelectedSensor(asset.sensors[0].sensorId)
      } else {
        setSelectedSensor('')
      }
    }
  }, [selectedAsset, assets])

  // 2. Обработчик генерации отчета
  const handleGenerateReport = async () => {
    if (!selectedAsset || !selectedSensor) {
      alert('Пожалуйста, выберите актив и датчик.')
      return
    }

    setLoading(true)

    const params = {
      reportType,
      asset: selectedAsset,
      sensorId: selectedSensor,
      startDate,
      endDate,
      format: reportFormat,
    }

    try {
      // Запрос на скачивание файла
      const response = await axios.get(`${API_BASE_URL}/api/reports/generate`, {
        params: params,
        responseType: 'blob', // Важно для получения бинарных данных файла
        headers: { Authorization: `Bearer ${token}` },
      })

      // Проверка на ошибку (если сервер вернул JSON, а не файл)
      if (response.data.type === 'application/json') {
        const errorText = await new Response(response.data).text()
        const errorJson = JSON.parse(errorText)
        alert(`Ошибка: ${errorJson.message}`)
      } else {
        // Создание ссылки для скачивания
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url

        // Извлекаем имя файла из заголовков (если доступно)
        const contentDisposition = response.headers['content-disposition']
        let fileName = 'report.csv'
        if (contentDisposition) {
          // 1. Поиск UTF-8 кодировки (filename*=UTF-8'') - приоритет
          let matches = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)
          if (matches && matches[1]) {
            // Декодируем, так как бэкенд отправил кодированный URL
            fileName = decodeURIComponent(matches[1])
          } else {
            // 2. Поиск стандартного filename="" (для совместимости)
            matches = /filename="([^"]+)"/.exec(contentDisposition)
            if (matches && matches[1]) {
              // Используем unescape для обработки пробелов/кириллицы, если они были закодированы
              fileName = matches[1].replace(/\\"/g, '"')
            }
          }
        }
        link.setAttribute('download', fileName)
        document.body.appendChild(link)
        link.click()
        link.remove()
        alert('Отчет успешно загружен!')
      }
    } catch (error) {
      alert(`Ошибка при загрузке отчета: ${error.response?.data?.message || 'Сервер не отвечает.'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className='container mt-4'
      style={{ maxWidth: '1200px' }}
    >
      <h1>Генерация отчетов</h1>
      <div className='card p-4 dark-card'>
        <h5
          className='mb-4'
          style={{ color: '#fff' }}
        >
          Параметры отчета (Исторические данные)
        </h5>

        <div className='row g-3'>
          {/* Выбор типа отчета */}
          <div className='col-md-5'>
            <label className='form-label text-light'>Тип Отчета:</label>
            <select
              className='form-select dark-input'
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={true}
            >
              <option value='SENSOR_HISTORY'>История показаний сенсоров (CSV)</option>
              {/* <option value="ALERTS_HISTORY">История показаний (CSV)</option> */}
            </select>
          </div>

          <div className='col-md-3'>
            {' '}
            {/* col-md-3 для лучшего распределения */}
            <label className='form-label text-light'>Тип Отчета:</label>
            <select
              className='form-select dark-input'
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={true}
            >
              <option value='SENSOR_HISTORY'>История показаний</option>
            </select>
          </div>

          {/* Новый блок: Выбор Формата Отчета */}
          <div className='col-md-3'>
            <label className='form-label text-light'>Формат:</label>
            <select
              className='form-select dark-input'
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value)}
            >
              <option value='CSV'>CSV</option>
              <option value='XLSX'>Excel (XLSX)</option>
              <option value='PDF'>PDF</option>
            </select>
          </div>

          {/* Выбор актива */}
          <div className='col-md-5'>
            <label className='form-label text-light'>Актив:</label>
            <select
              className='form-select dark-input'
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
            >
              {assets.map((a) => (
                <option
                  key={a.name}
                  value={a.name}
                >
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Выбор датчика */}
          <div className='col-md-6'>
            <label className='form-label text-light'>Датчик:</label>
            <select
              className='form-select dark-input'
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
            >
              {sensors.map((s) => (
                <option
                  key={s.sensorId}
                  value={s.sensorId}
                >
                  {s.sensorType} ({s.sensorId})
                </option>
              ))}
            </select>
          </div>

          {/* Начальная дата */}
          <div className='col-md-4'>
            <label className='form-label text-light'>Начальная Дата:</label>
            <input
              type='date'
              className='form-control dark-input'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Конечная дата */}
          <div className='col-md-4'>
            <label className='form-label text-light'>Конечная Дата:</label>
            <input
              type='date'
              className='form-control dark-input'
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Кнопка генерации */}
          <div className='col-md-4 d-flex align-items-end'>
            <button
              className='btn btn-primary w-100'
              onClick={handleGenerateReport}
              disabled={loading || !selectedSensor}
            >
              {loading ? 'Генерация...' : 'Сформировать отчет'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportGenerator
