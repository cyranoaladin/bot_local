import { useState } from 'react';
import type { FC } from 'react';
import useTradeStore from '../../store/useTradeStore';
import { DEFAULT_CONFIG } from '../../config/constants';

const BotConfig: FC = () => {
  const { config, updateConfig, isActive } = useTradeStore();
  const [tempConfig, setTempConfig] = useState(config);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number = value;
    
    // Convert numeric fields to numbers
    if (['sellThreshold', 'buyThreshold', 'targetGain', 'slippage'].includes(name)) {
      parsedValue = parseFloat(value) || 0;
    }
    
    setTempConfig({
      ...tempConfig,
      [name]: parsedValue,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig(tempConfig);
  };

  const handleReset = () => {
    setTempConfig(DEFAULT_CONFIG);
    updateConfig(DEFAULT_CONFIG);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-4">Bot Configuration</h3>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="sellThreshold" className="block text-sm font-medium text-gray-300 mb-1">
              Sell Threshold (%)
            </label>
            <input
              type="number"
              id="sellThreshold"
              name="sellThreshold"
              value={tempConfig.sellThreshold}
              onChange={handleChange}
              className="input w-full"
              step="0.1"
              min="0.1"
              disabled={isActive}
            />
            <p className="text-xs text-gray-400 mt-1">Sell when price increases by this percentage</p>
          </div>
          
          <div>
            <label htmlFor="buyThreshold" className="block text-sm font-medium text-gray-300 mb-1">
              Buy Threshold (%)
            </label>
            <input
              type="number"
              id="buyThreshold"
              name="buyThreshold"
              value={tempConfig.buyThreshold}
              onChange={handleChange}
              className="input w-full"
              step="0.1"
              min="0.1"
              disabled={isActive}
            />
            <p className="text-xs text-gray-400 mt-1">Buy when price decreases by this percentage</p>
          </div>
          
          <div>
            <label htmlFor="targetGain" className="block text-sm font-medium text-gray-300 mb-1">
              Target Daily Gain (%)
            </label>
            <input
              type="number"
              id="targetGain"
              name="targetGain"
              value={tempConfig.targetGain}
              onChange={handleChange}
              className="input w-full"
              step="0.1"
              min="0.1"
              disabled={isActive}
            />
          </div>
          
          <div>
            <label htmlFor="slippage" className="block text-sm font-medium text-gray-300 mb-1">
              Slippage Tolerance (%)
            </label>
            <input
              type="number"
              id="slippage"
              name="slippage"
              value={tempConfig.slippage}
              onChange={handleChange}
              className="input w-full"
              step="0.1"
              min="0.1"
              max="5"
              disabled={isActive}
            />
          </div>
          
          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="btn bg-gray-700 hover:bg-gray-600 text-white"
              disabled={isActive}
            >
              Reset to Default
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isActive}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BotConfig;
