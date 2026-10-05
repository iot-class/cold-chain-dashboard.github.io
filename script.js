// MENGGUNAKAN BROKER BARU (HIVEMQ)
    const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt"; 
    
    // PREFIX TOPIK BARU AGAR TIDAK BENTROK
    const BASE_TOPIC = "ioTKesehatan_Kelompok_4_7766"; 
    
    const TOPIC_TEMP = BASE_TOPIC + "/sensor/suhu";
    const TOPIC_CONN = BASE_TOPIC + "/status/koneksi";
    const TOPIC_THRESH = BASE_TOPIC + "/config/threshold";

    let maxTemp = 29.0;
    let minTemp = 2.0;
    let lastAlertTime = 0;

    const ctx = document.getElementById('tempChart').getContext('2d');
    const tempChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [], 
        datasets: [{
          label: 'Suhu (°C)',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    const client = mqtt.connect(MQTT_BROKER, { clientId: 'web_medis_' + Math.random().toString(16).substr(2, 8) });

    client.on('connect', () => {
      client.subscribe([TOPIC_TEMP, TOPIC_CONN, TOPIC_THRESH]);
    });

    client.on('message', (topic, payload) => {
      const msg = payload.toString();
      const now = new Date();
      const timeStr = now.toLocaleTimeString();

      if (topic === TOPIC_CONN) {
        const dot = document.getElementById('connDot');
        const txt = document.getElementById('connStatus');
        if (msg === "ONLINE") {
          dot.className = 'dot online'; txt.innerText = 'Perangkat Online';
        } else {
          dot.className = 'dot offline'; txt.innerText = 'Perangkat Offline';
          document.getElementById('tempDisplay').innerText = '--.-°C';
          document.getElementById('tempDisplay').className = 'temp-value';
        }
      }

      if (topic === TOPIC_TEMP) {
        const temp = parseFloat(msg);
        document.getElementById('tempDisplay').innerText = temp.toFixed(1) + '°C';
        
        tempChart.data.labels.push(timeStr);
        tempChart.data.datasets[0].data.push(temp);
        if (tempChart.data.labels.length > 30) {
          tempChart.data.labels.shift();
          tempChart.data.datasets[0].data.shift();
        }
        tempChart.update();

        checkThreshold(temp, timeStr, now.getTime());
      }

      if (topic === TOPIC_THRESH) {
        try {
          const config = JSON.parse(msg);
          maxTemp = config.max; minTemp = config.min;
          document.getElementById('inputMax').value = maxTemp;
          document.getElementById('inputMin').value = minTemp;
        } catch(e) {}
      }
    });

    function checkThreshold(temp, timeStr, timestamp) {
      const tempUI = document.getElementById('tempDisplay');
      const statUI = document.getElementById('statusText');
      
      if (temp > maxTemp || temp < minTemp) {
        tempUI.className = 'temp-value critical';
        statUI.innerText = temp > maxTemp ? 'Status: Terlalu Panas!' : 'Status: Terlalu Dingin!';
        statUI.style.color = 'var(--danger)';
        
        if (timestamp - lastAlertTime > 10000) {
          addLog(`Peringatan: Suhu mencapai ${temp.toFixed(1)}°C (Melewati batas)`, timeStr, true);
          lastAlertTime = timestamp;
        }
      } else {
        tempUI.className = 'temp-value';
        statUI.innerText = 'Status: Aman';
        statUI.style.color = 'var(--text-dim)';
      }
    }

    function addLog(message, time, isAlert = false) {
      const logList = document.getElementById('logList');
      const div = document.createElement('div');
      div.className = isAlert ? 'log-item alert' : 'log-item';
      div.innerHTML = `<span>${message}</span> <span>${time}</span>`;
      logList.prepend(div);
      if (logList.children.length > 50) logList.lastChild.remove();
    }

    function saveThreshold() {
      const max = parseFloat(document.getElementById('inputMax').value);
      const min = parseFloat(document.getElementById('inputMin').value);
      if (max <= min) return alert("Batas maksimal harus lebih besar dari batas minimal!");
      
      const payload = JSON.stringify({ max: max, min: min });
      client.publish(TOPIC_THRESH, payload, { retain: true }); 
      addLog(`Threshold diubah: Min ${min}°C, Max ${max}°C`, new Date().toLocaleTimeString());
    }