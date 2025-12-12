import React from 'react'

function AlertValue({ sensorType, value, alertThreshold, alertMessage, unit }) {
  let isAlert = false
  let displayMessage = `${value} ${unit}` // По умолчанию отображаем значение и единицу измерения
  let messageColor = 'white' // По умолчанию белый цвет

  const lowerCaseType = sensorType.toLowerCase()

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
      // В случае ошибки передачи данных, отображаем как есть
      displayMessage = `${value} ${unit}`
    }
  } else {
    // Для других типов датчиков
    displayMessage = `${value} ${unit}`
  }

  return <p style={{ color: messageColor }}>{displayMessage}</p>
}

export default AlertValue
