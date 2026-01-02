const mongoose = require('mongoose')

const ThresholdConfigSchema = new mongoose.Schema(
  {
    asset: { type: String, required: true }, // Имя Актива (напр., "Токарный станок")
    sensorId: { type: String, required: true }, // ID Сенсора (напр., "SNSR-0202")
    threshold: { type: Number, required: true }, // Пороговое значение
    sensor_type: { type: String, required: true },
    // Если нужно, можно добавить sensor_type для полноты картины, но sensorId должен быть уникален в рамках asset
  },
  { timestamps: true },
)

// Обеспечиваем уникальность пары Актив-Сенсор
ThresholdConfigSchema.index({ asset: 1, sensorId: 1 }, { unique: true })

const ThresholdConfigModel = mongoose.model('ThresholdConfig', ThresholdConfigSchema)
module.exports = ThresholdConfigModel
