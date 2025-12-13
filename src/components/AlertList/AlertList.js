import React from 'react'

function AlertValue({ sensorType, value, alertThreshold, alertMessage, unit }) {
  let isAlert = false
  let displayMessage = `${value} ${unit}` // По умолчанию отображаем значение и единицу измерения
  let messageColor = 'white' // По умолчанию белый цвет

  const lowerCaseType = sensorType.toLowerCase()

  // Проверка, что значение существует, иначе возвращаем "Н/Д"
  if (value === undefined || value === null) {
    return <p style={{ color: 'yellow' }}>Н/Д</p>
  }

  if (lowerCaseType.includes('температур') || lowerCaseType.includes('влажн')) {
    // Для температуры и влажности
    if (value > alertThreshold) {
      isAlert = true
      messageColor = 'red'
      displayMessage = alertMessage
        ? `${alertMessage}: ${value} ${unit}`
        : `Превышено значение: ${alertThreshold} -> ${value} ${unit}`
    }
  } else if (lowerCaseType.includes('давл')) {
    // Для датчиков давления
    if (
      typeof alertThreshold === 'object' &&
      alertThreshold !== null &&
      alertThreshold.min !== undefined &&
      alertThreshold.max !== undefined
    ) {
      const min = alertThreshold.min
      const max = alertThreshold.max

      if (value < min) {
        isAlert = true
        messageColor = 'red'
        displayMessage = alertMessage ? `${alertMessage}: ${value} ${unit}` : `Ниже порога (${min}): ${value} ${unit}`
      } else if (value > max) {
        isAlert = true
        messageColor = 'red'
        displayMessage = alertMessage ? `${alertMessage}: ${value} ${unit}` : `Выше порога (${max}): ${value} ${unit}`
      }
    } else {
      console.warn(
        'AlertValue: Для датчика давления ожидается объект alertThreshold {min, max}. Получено:',
        alertThreshold,
      )
      // В случае ошибки передачи данных, отображаем как есть, но не в состоянии тревоги
      displayMessage = `${value} ${unit}`
    }
  }

  if (lowerCaseType.includes('уровня')) {
    if (value < alertThreshold) {
      isAlert = true
      messageColor = 'red'
      displayMessage = alertMessage ? `${alertMessage}: ${value} ${unit}` : `Низкий уровень: -> ${value} ${unit}`
    } else {
      // Случай успеха для уровня
      displayMessage = `${value} ${unit}`
    }
  }

  // Если isAlert === false, мы отображаем исходное или нормальное сообщение
  if (!isAlert) {
    // Если тип неизвестен ИЛИ тип известен, но нет тревоги
    return <p style={{ color: 'white' }}>{`${value} ${unit}`}</p>
  }

  // Если isAlert === true (сработало для температуры, влажности, давления или уровня)
  return <p style={{ color: messageColor }}>{displayMessage}</p>
}
export default AlertValue
