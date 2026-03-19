const CONFIG = {
    API_BASE: 'https://api.openf1.org/v1',
    REFRESH_INTERVAL: 24 * 60 * 60 * 1000,
    LOCAL_STORAGE_KEYS: {
        DRIVERS_DATA: 'f1_drivers_data',
        RACE_HISTORY: 'f1_race_history',
        LAST_UPDATE: 'f1_last_update',
        USER_VOTE: 'f1_user_vote',
        VOTES: 'f1_votes'
    }
};

const state = {
    drivers: [],
    raceHistory: [],
    votes: {},
    userVote: null,
    lastUpdate: null,
    currentSeason: new Date().getFullYear(),
    chartInstances: {
        bump: null,
        restOfGrid: null,
        vote: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    loadVotesFromStorage();
    const lastUpdate = getLastUpdateTime();
    
    if (shouldRefreshData(lastUpdate)) {
        await fetchAndDisplayData();
    } else {
        loadDataFromStorage();
        displayCharts();
        populateDriverSelect();
        displayVotingResults();
    }
    
    setupEventListeners();
    
    setInterval(() => {
        const lastUpdate = getLastUpdateTime();
        if (shouldRefreshData(lastUpdate)) {
            fetchAndDisplayData();
        }
    }, 60 * 60 * 1000);
}

async function fetchAndDisplayData() {
    showStatus('Fetching latest data...', 'info');
    try {
        const standings = await fetchSeasonStandings();
        if (standings && standings.length > 0) {
            state.drivers = standings;
            saveDataToStorage(standings);
            updateLastUpdateTime();
            displayCharts();
            populateDriverSelect();
            displayVotingResults();
            showStatus('Data refreshed successfully!', 'success');
        } else {
            showStatus('No data available. Loading sample.', 'error');
            loadSampleData();
            displayCharts();
            populateDriverSelect();
            displayVotingResults();
        }
    } catch (error) {
        showStatus('Error fetching data. Using cached data if available.', 'error');
        loadDataFromStorage();
        displayCharts();
        populateDriverSelect();
        displayVotingResults();
    }
}

async function fetchSeasonStandings() {
    try {
        const season = state.currentSeason;
        const response = await fetch(`${CONFIG.API_BASE}/drivers?session_key=latest`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        const drivers = await response.json();
        const resultsResponse = await fetch(`${CONFIG.API_BASE}/results?session_key=latest`);
        const results = await resultsResponse.json();
        return processDriversData(drivers, results, season);
    } catch (error) {
        throw error;
    }
}

function processDriversData(drivers, results, season) {
    const processedDrivers = [];
    const resultMap = {};
    if (results && Array.isArray(results)) {
        results.forEach(result => {
            resultMap[result.driver_number] = result;
        });
    }
    if (drivers && Array.isArray(drivers)) {
        drivers.forEach((driver, index) => {
            const raceResult = resultMap[driver.driver_number] || {};
            processedDrivers.push({
                position: index + 1,
                name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Unknown',
                team: driver.team_name || 'Unknown',
                racePoints: raceResult.points || 0,
                seasonPoints: raceResult.points || 0,
                driverId: driver.driver_number || index + 1
            });
        });
    }
    return processedDrivers.sort((a, b) => a.position - b.position);
}

function loadSampleData() {
    state.drivers = [
        { position: 1, name: 'Max Verstappen', team: 'Red Bull Racing', racePoints: 25, seasonPoints: 393, driverId: 1 },
        { position: 2, name: 'Lando Norris', team: 'McLaren', racePoints: 18, seasonPoints: 358, driverId: 2 },
        { position: 3, name: 'Carlos Sainz', team: 'Ferrari', racePoints: 15, seasonPoints: 308, driverId: 3 },
        { position: 4, name: 'Lewis Hamilton', team: 'Mercedes', racePoints: 12, seasonPoints: 285, driverId: 4 },
        { position: 5, name: 'Charles Leclerc', team: 'Ferrari', racePoints: 10, seasonPoints: 275, driverId: 5 },
        { position: 6, name: 'Oscar Piastri', team: 'McLaren', racePoints: 8, seasonPoints: 260, driverId: 6 },
        { position: 7, name: 'George Russell', team: 'Mercedes', racePoints: 6, seasonPoints: 245, driverId: 7 },
        { position: 8, name: 'Fernando Alonso', team: 'Aston Martin', racePoints: 4, seasonPoints: 68, driverId: 8 },
        { position: 9, name: 'Yuki Tsunoda', team: 'Racing Bulls', racePoints: 2, seasonPoints: 52, driverId: 9 },
        { position: 10, name: 'Sergio Pérez', team: 'Red Bull Racing', racePoints: 1, seasonPoints: 45, driverId: 10 }
    ];
    state.raceHistory = [
        {
            raceName: 'Australia',
            positions: [
                { driverId: 1, position: 4 }, { driverId: 2, position: 2 }, { driverId: 3, position: 1 },
                { driverId: 4, position: 8 }, { driverId: 5, position: 3 }, { driverId: 6, position: 5 },
                { driverId: 7, position: 7 }, { driverId: 8, position: 6 }, { driverId: 9, position: 9 }, { driverId: 10, position: 10 }
            ]
        },
        {
            raceName: 'United States',
            positions: [
                { driverId: 1, position: 1 }, { driverId: 2, position: 2 }, { driverId: 3, position: 3 },
                { driverId: 4, position: 4 }, { driverId: 5, position: 5 }, { driverId: 6, position: 6 },
                { driverId: 7, position: 7 }, { driverId: 8, position: 8 }, { driverId: 9, position: 9 }, { driverId: 10, position: 10 }
            ]
        }
    ];
    saveDataToStorage(state.drivers);
    saveRaceHistoryToStorage(state.raceHistory);
    updateLastUpdateTime();
}

function populateDriverSelect() {
    const driverSelect = document.getElementById('driverSelect');
    if (!driverSelect) return;
    driverSelect.innerHTML = '<option value="">-- Choose a driver --</option>';
    state.drivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.driverId;
        option.textContent = `${driver.position}. ${driver.name} (${driver.team})`;
        driverSelect.appendChild(option);
    });
}

function displayCharts() {
    renderBumpChart();
    renderLatestRaceResults();
    renderVotingChart();
}

function renderBumpChart() {
    const chartDom = document.getElementById('bumpChart');
    if (!chartDom) return;
    if (!state.chartInstances.bump) {
        state.chartInstances.bump = echarts.init(chartDom);
    }
    const races = state.raceHistory.map(race => race.raceName);
    const seriesData = state.drivers.map(driver => {
        const dataPoints = state.raceHistory.map(race => {
            const pos = race.positions.find(p => p.driverId === driver.driverId);
            return pos ? pos.position : null;
        });
        return {
            name: driver.name,
            type: 'line',
            smooth: true,
            symbolSize: 8,
            data: dataPoints
        };
    });
    const option = {
        tooltip: { trigger: 'item' },
        grid: { left: '5%', right: '15%', bottom: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: races,
            axisLabel: { color: '#e8e8e8' }
        },
        yAxis: {
            type: 'value',
            inverse: true,
            min: 1,
            max: 10,
            axisLabel: { color: '#e8e8e8' },
            splitLine: { lineStyle: { color: '#2a3f5f' } }
        },
        series: seriesData
    };
    state.chartInstances.bump.setOption(option);
}

function renderLatestRaceResults() {
    const sortedDrivers = [...state.drivers].sort((a, b) => a.position - b.position);
    const top5 = sortedDrivers.slice(0, 5);
    const restOfGrid = sortedDrivers.slice(5);
    renderTop5HTML(top5);
    renderRestOfGridChart(restOfGrid);
}

function renderTop5HTML(top5Drivers) {
    const container = document.getElementById('top5Container');
    if (!container) return;
    container.innerHTML = '';
    const maxPoints = top5Drivers.length > 0 ? (top5Drivers[0].racePoints || 25) : 25;
    top5Drivers.forEach((driver, index) => {
        const heightPct = Math.max((driver.racePoints / maxPoints) * 100, 15);
        const wrapper = document.createElement('div');
        wrapper.className = 'top5-bar-wrapper';
        wrapper.innerHTML = `
            <div class="top5-info">
                <img src="placeholder_car.png" alt="${driver.team} Car" class="top5-car-img" />
                <span class="top5-driver-name">${driver.name.split(' ').pop()}</span>
                <span class="top5-points">${driver.racePoints} pts</span>
            </div>
            <div class="top5-bar pos-${index + 1}" style="height: ${heightPct}%"></div>
        `;
        container.appendChild(wrapper);
    });
}

function renderRestOfGridChart(restDrivers) {
    const canvas = document.getElementById('restOfGridChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.chartInstances.restOfGrid) {
        state.chartInstances.restOfGrid.destroy();
    }
    state.chartInstances.restOfGrid = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: restDrivers.map(d => d.name),
            datasets: [{
                label: 'Race Points',
                data: restDrivers.map(d => d.racePoints),
                backgroundColor: '#2a3f5f',
                borderColor: '#60a5fa',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { color: '#2a3f5f' },
                    ticks: { color: '#e8e8e8' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e8e8e8' }
                }
            }
        }
    });
}

function renderVotingChart() {
    const canvas = document.getElementById('voteChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.chartInstances.vote) {
        state.chartInstances.vote.destroy();
    }
    const sortedVotes = Object.entries(state.votes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    const labels = sortedVotes.map(v => v[0]);
    const data = sortedVotes.map(v => v[1]);
    const totalVotes = data.reduce((sum, count) => sum + count, 0);
    const totalVotesSpan = document.getElementById('totalVotes');
    if (totalVotesSpan) totalVotesSpan.textContent = totalVotes;
    const yourVoteSpan = document.getElementById('yourVote');
    if (yourVoteSpan) {
        if (state.userVote) {
            yourVoteSpan.textContent = state.userVote.driverName;
            yourVoteSpan.style.color = 'var(--accent-yellow)';
        } else {
            yourVoteSpan.textContent = 'Not voted';
            yourVoteSpan.style.color = '#888';
        }
    }
    state.chartInstances.vote = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Votes',
                data: data,
                backgroundColor: '#c41e3a',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const percentage = totalVotes > 0 ? ((context.raw / totalVotes) * 100).toFixed(1) : 0;
                            return `${context.raw} votes (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e8e8e8', font: { size: 12 } }
                }
            }
        }
    });
}

function displayVotingResults() {
    renderVotingChart();
}

function voteForDriver(event, driverId, driverName) {
    if (event) event.preventDefault();
    if (!driverId && !driverName) {
        const driverSelect = document.getElementById('driverSelect');
        driverId = parseInt(driverSelect.value);
        if (!driverId) {
            showStatus('Please select a driver to vote for', 'error');
            return;
        }
        const driver = state.drivers.find(d => d.driverId === driverId);
        if (!driver) {
            showStatus('Driver not found', 'error');
            return;
        }
        driverName = driver.name;
    }
    state.userVote = { driverId, driverName };
    saveUserVoteToStorage({ driverId, driverName });
    if (!state.votes[driverName]) {
        state.votes[driverName] = 0;
    }
    state.votes[driverName]++;
    saveVotesToStorage();
    const driverSelect = document.getElementById('driverSelect');
    if (driverSelect) driverSelect.value = '';
    displayVotingResults();
    showStatus(`Vote recorded for ${driverName}!`, 'success');
}

function saveDataToStorage(drivers) {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(drivers));
    } catch (error) {}
}

function loadDataFromStorage() {
    try {
        const data = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA);
        if (data) {
            state.drivers = JSON.parse(data);
        }
    } catch (error) {}
}

function saveRaceHistoryToStorage(raceHistory) {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY, JSON.stringify(raceHistory));
    } catch (error) {}
}

function saveVotesToStorage() {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES, JSON.stringify(state.votes));
    } catch (error) {}
}

function loadVotesFromStorage() {
    try {
        const votes = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES);
        if (votes) state.votes = JSON.parse(votes);
        const userVote = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTE);
        if (userVote) state.userVote = JSON.parse(userVote);
        const raceHistory = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY);
        if (raceHistory) state.raceHistory = JSON.parse(raceHistory);
    } catch (error) {}
}

function saveUserVoteToStorage(vote) {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTE, JSON.stringify(vote));
    } catch (error) {}
}

function updateLastUpdateTime() {
    const now = new Date().toISOString();
    state.lastUpdate = now;
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE, now);
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Last Updated: ${formatDateTime(now)}`;
    }
}

function getLastUpdateTime() {
    const lastUpdate = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE);
    return lastUpdate ? new Date(lastUpdate) : null;
}

function shouldRefreshData(lastUpdate) {
    if (!lastUpdate) return true;
    const timeDiff = Date.now() - lastUpdate.getTime();
    return timeDiff > CONFIG.REFRESH_INTERVAL;
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    if (type !== 'error') {
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 5000);
    }
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchAndDisplayData();
        });
    }
    const voteSubmitBtn = document.getElementById('voteSubmitBtn');
    if (voteSubmitBtn) {
        voteSubmitBtn.addEventListener('click', (e) => voteForDriver(e, null, null));
    }
}
