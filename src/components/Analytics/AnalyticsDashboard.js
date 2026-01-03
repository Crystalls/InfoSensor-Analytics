import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import '../Analytics/AnalyticsDashboard.css'
import { API_BASE_URL } from '../../services/api'
import moment from 'moment'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts'

const AnalyticsDashboard = ({ user, token }) => {
  const [chartData, setChartData] = useState([])
  const [currentStateData, setCurrentStateData] = useState([])
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [assetSensorMap, setAssetSensorMap] = useState({})
  const [thresholdsByTypeMap, setThresholdsByTypeMap] = useState({}) // Карта порогов по ТИПУ
  const [thresholdsForGauge, setThresholdsForGauge] = useState({ min: 0, max: 100 }) // Пороги для Gauge

  const allowedAssets = user?.access_rights?.allowedAssets || []

  const today = moment().format('YYYY-MM-DD')
  const threeDaysAgo = moment().subtract(3, 'days').format('YYYY-MM-DD')

  const [selectedAsset, setSelectedAsset] = useState(allowedAssets[0] || '')
  const [selectedSensor, setSelectedSensor] = useState('')
  const [startDate, setStartDate] = useState(threeDaysAgo)
  const [endDate, setEndDate] = useState(today)

  // --- ФУНКЦИИ ЗАГРУЗКИ ---

  const fetchFilterOptions = useCallback(async () => {
    if (!token) {
      setOptionsLoading(false)
      return
    }
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/config/sensor-options`, config)

      const map = response.data.assetSensorMap || {}
      setAssetSensorMap(map)

      const assetsFromMap = Object.keys(map)

      if (assetsFromMap.length > 0 && !selectedAsset) {
        setSelectedAsset(assetsFromMap[0])
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
      setError('Не удалось загрузить данные для фильтров.')
    } finally {
      setOptionsLoading(false)
    }
  }, [token, selectedAsset])

  const fetchChartData = useCallback(async () => {
    if (!token || !selectedAsset || !selectedSensor || !startDate || !endDate) return
    setLoading(true)
    setError(null)
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const url = `${API_BASE_URL}/api/historical-data?asset=${selectedAsset}&sensorId=${selectedSensor}&startDate=${startDate}&endDate=${endDate}`
      const response = await axios.get(url, config)
      setChartData(response.data.chartData)
    } catch (err) {
      console.error('Error fetching chart data:', err)
      setError(err.response?.data?.message || 'Ошибка загрузки данных графика.')
    } finally {
      setLoading(false)
    }
  }, [token, selectedAsset, selectedSensor, startDate, endDate])

  // НОВАЯ ФУНКЦИЯ: Загрузка порогов по ТИПУ
  const fetchThresholdsByType = useCallback(async () => {
    const sensorsList = assetSensorMap[selectedAsset] || []
    const sensorConfig = sensorsList.find((s) => s.id === selectedSensor)

    if (!token || !sensorConfig || !sensorConfig.type) {
      setThresholdsForGauge({ min: 0, max: 100 })
      return
    }

    const sensorTypeEncoded = encodeURIComponent(sensorConfig.type)

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      // Используем новый роут, который отдает пороги по типу
      const url = `${API_BASE_URL}/api/thresholds-by-type?type=${sensorTypeEncoded}`

      const response = await axios.get(url, config)

      // Ожидаем { thresholdMap: { "Тип": { min_value: X, max_value: Y } } }
      const typeThresholds = response.data.thresholdMap?.[sensorConfig.type]

      if (typeThresholds && typeThresholds.max_value !== undefined) {
        setThresholdsForGauge({
          min: parseFloat(typeThresholds.min_value) || 0, // Парсим на всякий случай
          max: parseFloat(typeThresholds.max_value),
        })
      } else {
        setThresholdsForGauge({ min: 0, max: 100 })
      }
    } catch (err) {
      console.warn(`Thresholds by type not found for ${sensorConfig.type}. Using default.`)
      setThresholdsForGauge({ min: 0, max: 100 })
    }
  }, [token, selectedAsset, selectedSensor, assetSensorMap])

  const fetchCurrentState = useCallback(async () => {
    // ... (Остается прежним) ...
    if (!token || !selectedAsset) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const url = `${API_BASE_URL}/api/current-state-for-asset?asset=${selectedAsset}`
      const response = await axios.get(url, config)
      setCurrentStateData(response.data.currentState || [])
    } catch (err) {
      console.warn('Could not fetch current state for asset:', selectedAsset)
      setCurrentStateData([])
    }
  }, [token, selectedAsset])

  // --- ЭФФЕКТЫ ---
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Запуск зависимых запросов
  useEffect(() => {
    if (selectedAsset) {
      fetchCurrentState()
      fetchThresholdsByType() // Обновляем пороги Gauge

      if (selectedSensor && startDate && endDate) {
        fetchChartData()
      }
    }
  }, [selectedAsset, fetchChartData, fetchCurrentState, fetchThresholdsByType, selectedSensor, startDate, endDate])

  // Обработчик смены Актива
  const handleAssetChange = (newAsset) => {
    setSelectedAsset(newAsset)
    setSelectedSensor('')

    const sensors = assetSensorMap[newAsset]
    if (sensors && sensors.length > 0) {
      setSelectedSensor(sensors[0].id)
    }
  }

  const sensorsForSelectedAsset = assetSensorMap[selectedAsset] || []

  // --- ВСПОМОГАТЕЛЬНЫЙ КОМПОНЕНТ (GAUGE) ---
  const StatusGauge = ({ value, min, max, sensorId }) => {
    const minThreshold = parseFloat(min)
    const maxThreshold = parseFloat(max)

    const range = maxThreshold - minThreshold

    const normalizedValue =
      range > 0 ? Math.min(100, Math.max(0, ((value - minThreshold) / range) * 100)) : value > maxThreshold ? 100 : 0

    let color = '#28a745'
    if (maxThreshold > 0 && value > maxThreshold * 1.05) {
      color = '#dc3545'
    } else if (maxThreshold > 0 && value >= maxThreshold) {
      color = '#ffc107'
    }

    const gaugeData = [{ name: 'Status', value: normalizedValue, fill: color }]

    return (
      <div
        className='gauge-wrapper p-3 dark-card'
        style={{ height: '200px', width: '100%' }}
      >
        <h5
          className='text-light text-center mb-1'
          style={{ fontSize: '0.9rem' }}
        >
          {sensorId}
        </h5>
        <ResponsiveContainer
          width='100%'
          height='80%'
        >
          <RadialBarChart
            cx='50%'
            cy='55%'
            innerRadius='50%'
            outerRadius='90%'
            barSize={15}
            data={gaugeData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              minAngle={15}
              label={{ position: 'insideStart', fill: '#fff', fontSize: '1.2rem' }}
              background={{ fill: '#3a3a40' }}
              clockWise
              dataKey='value'
              cornerRadius={10}
            />
            <text
              x='50%'
              y='55%'
              textAnchor='middle'
              dominantBaseline='middle'
              className='text-light'
              style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
            >
              {value.toFixed(2)}
            </text>
          </RadialBarChart>
        </ResponsiveContainer>
        <p
          className='text-center text-muted'
          style={{ fontSize: '0.8rem', margin: '0' }}
        >
          Норма: {minThreshold.toFixed(1)} - {maxThreshold.toFixed(1)}
        </p>
      </div>
    )
  }

  // --- РЕНДЕРИНГ ---
  return (
    <div className='container mt-4'>
      <h1>Аналитические Графики</h1>
      <p
        className='lead text-muted'
        style={{ color: '#ff6666' }}
      >
        Анализ исторических данных. Приветствуем, {user?.nameU}!
      </p>

      {/* --- БЛОК ФИЛЬТРОВ --- */}
      <div className='p-3 mb-4 border rounded shadow-lg analytics-filter-bar'>
        {optionsLoading ? (
          <div className='row g-3 align-items-end'>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className='col-md-2'
              >
                <div className='skeleton-base skeleton-label'></div>
                <div className='skeleton-base skeleton-input-bar w-100'></div>
              </div>
            ))}
          </div>
        ) : (
          <div className='row g-3 align-items-end'>
            <div className='col-md-3'>
              <label className='form-label text-light'>Актив:</label>
              <select
                className='form-select dark-input'
                value={selectedAsset}
                onChange={(e) => handleAssetChange(e.target.value)}
                disabled={loading || Object.keys(assetSensorMap).length === 0}
              >
                {Object.keys(assetSensorMap).map((asset) => (
                  <option
                    key={asset}
                    value={asset}
                  >
                    {asset}
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-3'>
              <label className='form-label text-light'>Сенсор:</label>
              <select
                className='form-select dark-input'
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                disabled={loading || sensorsForSelectedAsset.length === 0}
              >
                {sensorsForSelectedAsset.length === 0 ? (
                  <option value=''>Нет данных сенсоров для этого актива</option>
                ) : (
                  sensorsForSelectedAsset.map((sensor) => (
                    <option
                      key={sensor.id}
                      value={sensor.id}
                    >
                      {' '}
                      {sensor.type} ({sensor.id})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className='col-md-2'>
              <label className='form-label text-light'>Начальная Дата:</label>
              <input
                type='date'
                className='form-control dark-input'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className='col-md-2'>
              <label className='form-label text-light'>Конечная Дата:</label>
              <input
                type='date'
                className='form-control dark-input'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className='col-md-2'>
              <button
                className='btn btn-primary w-100'
                onClick={fetchChartData}
                disabled={loading || !selectedSensor || !selectedAsset}
              >
                {loading ? 'Загрузка...' : 'Обновить График'}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ----------------------------------- */}

      {error && <div className='alert alert-danger'>{error}</div>}

      {/* --- ГРАФИК 1: ИСТОРИЧЕСКИЕ ДАННЫЕ --- */}
      <div
        className='card p-3 chart-container'
        style={{ border: 'none', height: '400px', marginBottom: '20px' }}
      >
        {chartData.length > 0 && !loading ? (
          <ResponsiveContainer
            width='100%'
            height='100%'
          >
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray='3 3'
                stroke='#444'
              />
              <XAxis
                dataKey='time'
                stroke='#ccc'
                tickFormatter={(tick) => moment(tick).format('DD.MM HH:mm')}
                interval='preserveStartEnd'
              />
              <YAxis stroke='#ccc' />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e24', border: '1px solid #666', color: 'white' }}
                labelFormatter={(label) => moment(label).format('YYYY-MM-DD HH:mm:ss')}
                formatter={(value) => [`${value.toFixed(3)}`, `Значение`]}
                position={{ y: -10, x: -10 }}
              />
              <Line
                type='monotone'
                dataKey='value'
                stroke='#007bff'
                strokeWidth={3}
                dot={false}
                name={`История ${selectedSensor}`}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : loading || optionsLoading ? (
          <div className='skeleton-chart-container p-4'>
            <div
              className='skeleton-base'
              style={{ height: '90%', width: '100%' }}
            ></div>
          </div>
        ) : (
          <p
            className='text-center text-warning'
            style={{ paddingTop: '150px' }}
          >
            Нет исторических данных для выбранных параметров. Проверьте диапазон дат.
          </p>
        )}
      </div>

      {/* --- ГРАФИК 2: ТЕКУЩЕЕ СОСТОЯНИЕ (Gauge) --- */}
      {currentStateData.length > 0 && !loading && (
        <div className='row g-3 mt-3'>
          <h4 className='text-light mb-3'>Текущий Статус Сенсоров Актива: {selectedAsset}</h4>

          {currentStateData.map((item, index) => (
            <div
              className='col-lg-3 col-md-6'
              key={index}
            >
              <StatusGauge
                value={item.value}
                min={thresholdsForGauge.min}
                max={thresholdsForGauge.max}
                sensorId={item.sensor_id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AnalyticsDashboard
