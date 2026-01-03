import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  const [thresholdsByTypeMap, setThresholdsByTypeMap] = useState({})

  // Ref для интервала текущего состояния
  const currentStateIntervalRef = useRef(null)

  const allowedAssets = user?.access_rights?.allowedAssets || []

  const today = moment().format('YYYY-MM-DD')
  const MonthsAgo = moment().subtract(1, 'months').format('YYYY-MM-DD')

  const [selectedAsset, setSelectedAsset] = useState(allowedAssets[0] || '')
  const [selectedSensor, setSelectedSensor] = useState('')
  const [startDate, setStartDate] = useState(MonthsAgo)
  const [endDate, setEndDate] = useState(today)

  // --- ФУНКЦИИ ЗАГРУЗКИ (СТАБИЛЬНЫЕ) ---

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

  const fetchAllThresholds = useCallback(async () => {
    if (!token) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/thresholds-by-type`, config)
      setThresholdsByTypeMap(response.data.thresholdMap || {})
    } catch (err) {
      console.error('Failed to load global thresholds:', err)
    }
  }, [token])

  const fetchCurrentState = useCallback(async () => {
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
  }, [token, selectedAsset]) // Зависит от selectedAsset

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

  const getThresholdsForSensor = (sensorId, allThresholds, assetMap, selectedAsset) => {
    const sensorsList = assetMap[selectedAsset] || []
    const sensorConfig = sensorsList.find((s) => s.id === sensorId)

    const sensorType = sensorConfig?.type

    if (sensorType && allThresholds[sensorType]) {
      const config = allThresholds[sensorType]
      return {
        min: parseFloat(config.min_value) || 0,
        max: parseFloat(config.max_value) || 100,
        // Возвращаем Type и ID для отображения
        title: `${sensorType} (${sensorId})`,
      }
    }
    return { min: 0, max: 100 }
  }

  // --- ЭФФЕКТЫ И POLLING ---

  // Эффект 1: Загрузка фильтров и порогов (запускается один раз)
  useEffect(() => {
    fetchFilterOptions()
    fetchAllThresholds()
  }, [fetchFilterOptions, fetchAllThresholds])

  // Эффект 2: POLLING ТЕКУЩЕГО СОСТОЯНИЯ
  useEffect(() => {
    // Очистка старого интервала
    if (currentStateIntervalRef.current) {
      clearInterval(currentStateIntervalRef.current)
    }

    if (selectedAsset && token) {
      // 1. Запуск первого запроса
      fetchCurrentState()

      // 2. Установка интервала
      currentStateIntervalRef.current = setInterval(() => {
        fetchCurrentState()
      }, 5000)
    }

    // 3. Очистка при смене selectedAsset или при размонтировании
    return () => {
      if (currentStateIntervalRef.current) {
        clearInterval(currentStateIntervalRef.current)
      }
    }
  }, [selectedAsset, token, fetchCurrentState]) // Перезапускается только при смене Актива

  // Эффект 3: Запуск запроса графика (запускается при смене фильтров)
  useEffect(() => {
    if (selectedAsset && selectedSensor && startDate && endDate) {
      fetchChartData()
    }
  }, [selectedAsset, selectedSensor, startDate, endDate, fetchChartData])

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
  const StatusGauge = ({ sensor, allThresholds, assetMap, selectedAsset }) => {
    const { min, max, title } = getThresholdsForSensor(sensor.sensor_id, allThresholds, assetMap, selectedAsset)
    const value = sensor.value

    const minThreshold = min
    const maxThreshold = max

    const range = maxThreshold - minThreshold

    const normalizedValue =
      range > 0 ? Math.min(100, Math.max(0, ((value - minThreshold) / range) * 100)) : value > maxThreshold ? 100 : 0

    let color = '#28a745'
    if (value > maxThreshold || value < minThreshold) {
      color = '#dc3545' // Красная тревога
    } else if (value >= maxThreshold * 0.95 && value < maxThreshold) {
      color = '#ffc107' // Желтый: близко к максимуму
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
          {title}
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
            {/* Убрали label, чтобы скрыть "100" */}
            <RadialBar
              minAngle={15}
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
      {/* ... (JSX остается прежним) ... */}
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

      {/* --- ГРАФИК 2: ТЕКУЩЕЕ СОСТОЯНИЕ (Gauge Chart - только для выбранного сенсора) --- */}
      {selectedSensor && currentStateData.length > 0 && (
        <div className='row g-3 mt-3'>
          <h4 className='text-light mb-3'>Текущий статус сенсора:</h4>

          {currentStateData
            .filter((item) => item.sensor_id === selectedSensor)
            .map((item) => (
              <div
                className='col-lg-3 col-md-6'
                key={item.sensor_id}
              >
                <StatusGauge
                  sensor={item}
                  allThresholds={thresholdsByTypeMap}
                  assetMap={assetSensorMap}
                  selectedAsset={selectedAsset}
                />
              </div>
            ))}
        </div>
      )}

      {!selectedSensor && currentStateData.length > 0 && (
        <div className='row g-3 mt-3'>
          <h4 className='text-light mb-3'>Текущий Статус Сенсоров</h4>
          <p className='text-muted'>Выберите сенсор в фильтре, чтобы увидеть его текущее состояние.</p>
        </div>
      )}
    </div>
  )
}

export default AnalyticsDashboard
