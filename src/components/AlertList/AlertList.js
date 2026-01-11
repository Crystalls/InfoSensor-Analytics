import React from 'react'

function AlertValue({ sensorType, value, alertThreshold, alertMessage, unit }) {
  let isAlert = false
  let messageColor = 'white'

  // --- ИСПРАВЛЕНИЕ: Объявление переменной ---
  const lowerCaseType = sensorType.toLowerCase()
  // ------------------------------------------

  if (value === undefined || value === null) {
    return <p style={{ color: 'yellow' }}>Н/Д</p>
  }

  // Мы ожидаем, что alertThreshold будет объектом {min, max}
  const minThreshold = parseFloat(alertThreshold?.min)
  const maxThreshold = parseFloat(alertThreshold?.max)

  const isMaxValid = !isNaN(maxThreshold)
  const isMinValid = !isNaN(minThreshold)

  // --- ЛОГИКА ОПРЕДЕЛЕНИЯ АЛЕРТА (НЕ ФОРМИРОВАНИЯ СООБЩЕНИЯ) ---

  if (lowerCaseType.includes('температур') || lowerCaseType.includes('влажн')) {
    // ТРЕВОГА: value > MAX
    if (isMaxValid && value > maxThreshold) {
      isAlert = true
    }
  } else if (lowerCaseType.includes('давл')) {
    // ТРЕВОГА: value < MIN или value > MAX
    if (isMinValid && isMaxValid) {
      if (value < minThreshold || value > maxThreshold) {
        isAlert = true
      }
    }
  } else if (lowerCaseType.includes('температур почв')) {
    // ТРЕВОГА: value < MIN или value > MAX
    if (isMinValid && isMaxValid) {
      if (value < minThreshold || value > maxThreshold) {
        isAlert = true
      }
    }
  } else if (lowerCaseType.includes('кислот')) {
    // ТРЕВОГА: value < MIN или value > MAX
    if (isMinValid && isMaxValid) {
      if (value < minThreshold || value > maxThreshold) {
        isAlert = true
      }
    }
  } else if (lowerCaseType.includes('уровня')) {
    // ТРЕВОГА: value < MIN
    if (isMinValid && value < minThreshold) {
      isAlert = true
    }
  } else if (lowerCaseType.includes('вибрац')) {
    // ТРЕВОГА: value > MAX
    if (isMaxValid && value > maxThreshold) {
      isAlert = true
    }
  } else if (lowerCaseType.includes('солен')) {
    // ТРЕВОГА: value > MAX
    if (isMaxValid && value > maxThreshold) {
      isAlert = true
    }
  } else if (lowerCaseType.includes('углекисл')) {
    // ТРЕВОГА: value > MAX
    if (isMaxValid && value > maxThreshold) {
      isAlert = true
    }
  }

  // --- РЕНДЕРИНГ И СООБЩЕНИЯ ---

  if (isAlert) {
    messageColor = 'red'

    if (alertMessage) {
      // Если родитель передал сообщение, используем его
      return <p style={{ color: messageColor }}>{alertMessage}</p>
    } else {
      // Запасной вариант, если isAlert true, но сообщение не пришло
      return (
        <p style={{ color: messageColor }}>
          Тревога! {value} {unit}
        </p>
      )
    }
  }

  // Если нет тревоги
  return <p style={{ color: 'white' }}>{`${value} ${unit}`}</p>
}
export default AlertValue
