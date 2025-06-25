import './index.css'
import WalletProvider from './components/wallet/WalletProvider'
import Dashboard from './components/dashboard/Dashboard'

function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gray-900">
        <Dashboard />
      </div>
    </WalletProvider>
  )
}

export default App
