import React from 'react';

function AlertValue({ sensorType, value, alertThreshold, alertMessage, unit }) {
    const isAlert = value > alertThreshold; // Compare value with threshold

    return (
        isAlert ? (
            <p style={{ color: 'red' }}>
                {alertMessage} : {value} {unit}
            </p>
        ) : (
            <p style={{ color: 'white' }}>{value} {unit}</p>
        )
    );
}

export default AlertValue