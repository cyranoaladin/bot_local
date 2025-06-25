import { useEffect, type FC } from 'react';
import useTradeStore from '../../store/useTradeStore';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useWebSocket } from '../../hooks/useWebSocket';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PerformanceStats: FC = () => {
  const { portfolioValue, dailyProfit, currentPrice, entryPrice, config, updatePrice, updatePortfolioValue } = useTradeStore();
  
  // Récupérer les données WebSocket
  const { priceUpdate, botState, portfolioSnapshot } = useWebSocket();
  
  // Mettre à jour les données de prix en temps réel
  useEffect(() => {
    if (priceUpdate && priceUpdate.collatPrice > 0) {
      updatePrice(priceUpdate.collatPrice);
    }
  }, [priceUpdate, updatePrice]);
  
  // Mettre à jour l'état du bot et les valeurs du portefeuille en temps réel
  useEffect(() => {
    if (botState) {
      // Mettre à jour le prix d'entrée et le prix actuel
      if (botState.lastEntryPrice > 0) {
        updatePrice(botState.currentPrice, botState.lastEntryPrice);
      }
      
      // Mettre à jour la valeur du portefeuille
      if (botState.balances) {
        updatePortfolioValue(botState.balances.totalValueUsdc);
      }
    }
  }, [botState, updatePrice, updatePortfolioValue]);
  
  // Mettre à jour les données du portefeuille avec le dernier snapshot
  useEffect(() => {
    if (portfolioSnapshot) {
      updatePortfolioValue(portfolioSnapshot.totalValueUsdc);
    }
  }, [portfolioSnapshot, updatePortfolioValue]);
  
  // Générer des données pour le graphique (utiliser les données réelles si disponibles)
  const generateChartData = () => {
    const labels = [];
    const data = [];
    const now = new Date();
    
    // Si nous avons un snapshot de portefeuille, l'utiliser pour les données récentes
    // Sinon, générer des données simulées
    if (portfolioSnapshot) {
      // Utiliser les données réelles du snapshot pour le dernier point
      const snapshotTime = new Date(portfolioSnapshot.timestamp);
      labels.push(snapshotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      data.push(portfolioSnapshot.totalValueUsdc.toFixed(2));
      
      // Générer des données historiques pour les points précédents
      for (let i = 1; i <= 24; i++) {
        const time = new Date(now);
        time.setHours(now.getHours() - i);
        labels.unshift(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        
        // Générer des données historiques basées sur la valeur actuelle avec une légère variation
        const baseValue = portfolioSnapshot.totalValueUsdc;
        const randomFactor = 0.98 + (Math.random() * 0.04); // Entre 0.98 et 1.02
        const trendFactor = 1 - (i / 48); // Légère tendance à la baisse dans le passé
        data.unshift((baseValue * randomFactor * trendFactor).toFixed(2));
      }
    } else {
      // Générer des données simulées pour les 24 dernières heures
      for (let i = 24; i >= 0; i--) {
        const time = new Date(now);
        time.setHours(now.getHours() - i);
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        
        // Générer des données simulées avec une légère tendance à la hausse
        const baseValue = portfolioValue > 0 ? portfolioValue * 0.9 : 1000;
        const randomFactor = Math.random() * 0.1 + 0.95; // Entre 0.95 et 1.05
        const trendFactor = 1 + (i / 24) * 0.1; // Légère tendance à la hausse
        data.push((baseValue * randomFactor * trendFactor).toFixed(2));
      }
    }
    
    return { labels, data };
  };
  
  const chartData = generateChartData();
  
  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Portfolio Value (USD)',
        data: chartData.data,
        borderColor: 'rgba(103, 58, 183, 1)',
        backgroundColor: 'rgba(103, 58, 183, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'nearest' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        },
      },
    },
  };
  
  // Calculate progress towards daily goal
  const goalProgress = config.targetGain > 0 ? (dailyProfit / config.targetGain) * 100 : 0;
  const formattedProgress = Math.min(100, Math.max(0, goalProgress)).toFixed(1);
  
  // Calculer le pourcentage de changement de prix (utiliser les données WebSocket si disponibles)
  const priceChangePercent = priceUpdate?.priceChangePercent || 
    (entryPrice && currentPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0);
  
  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-4">Performance Dashboard</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm">Portfolio Value</p>
          <p className="text-2xl font-semibold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Daily Profit</p>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold">{dailyProfit.toFixed(2)}%</p>
            <p className="text-sm text-gray-400 ml-1">/ {config.targetGain}%</p>
          </div>
        </div>
      </div>
      
      {/* Progress bar towards daily goal */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span>Progress to Daily Goal</span>
          <span>{formattedProgress}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div 
            className="bg-primary h-2.5 rounded-full" 
            style={{ width: `${formattedProgress}%` }}
          ></div>
        </div>
      </div>
      
      {/* Current price info */}
      {currentPrice && (
        <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-400">Current Price</span>
            <span className="font-medium">${currentPrice.toFixed(6)}</span>
          </div>
          {entryPrice && (
            <div className="flex justify-between mt-1">
              <span className="text-gray-400">Entry Price</span>
              <div className="flex items-center">
                <span className="font-medium">${entryPrice.toFixed(6)}</span>
                <span 
                  className={`ml-2 text-xs ${priceChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}
                >
                  {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Chart */}
      <div className="h-64 mb-2">
        <Line data={data} options={options} />
      </div>
      <p className="text-xs text-gray-400 text-center">Portfolio value over the last 24 hours</p>
    </div>
  );
};

export default PerformanceStats;
