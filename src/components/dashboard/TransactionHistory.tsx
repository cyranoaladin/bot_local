import { useEffect, type FC } from 'react';
import useTradeStore from '../../store/useTradeStore';
import { useWebSocket } from '../../hooks/useWebSocket';

const TransactionHistory: FC = () => {
  const { transactions, addTransaction } = useTradeStore();
  
  // Récupérer les données WebSocket
  const { latestTransaction } = useWebSocket();
  
  // Mettre à jour les transactions en temps réel
  useEffect(() => {
    if (latestTransaction) {
      // Convertir la transaction WebSocket en format de transaction du store
      const storeTransaction = {
        id: `tx-${Date.now()}`, // Générer un ID de type string
        type: latestTransaction.type as 'BUY' | 'SELL',
        amount: latestTransaction.tokenAmount, // Utiliser tokenAmount au lieu de amount
        price: latestTransaction.price,
        timestamp: typeof latestTransaction.timestamp === 'string' ? 
          new Date(latestTransaction.timestamp).getTime() : Date.now(), // Convertir en timestamp numérique
        txHash: latestTransaction.txHash || '',
        status: latestTransaction.status as 'PENDING' | 'CONFIRMED' | 'FAILED'
      };
      
      // Ajouter la transaction au store
      addTransaction(storeTransaction);
    }
  }, [latestTransaction, addTransaction]);
  
  const exportToCsv = () => {
    if (transactions.length === 0) return;
    
    // Format transactions for CSV
    const headers = ['ID', 'Type', 'Amount', 'Price', 'Date', 'Status', 'Transaction Hash'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(tx => [
        tx.id,
        tx.type,
        tx.amount,
        tx.price,
        new Date(tx.timestamp).toISOString(),
        tx.status,
        tx.txHash
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `collat-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  const truncateHash = (hash: string) => {
    return hash.length > 10 ? `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}` : hash;
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-400">Confirmed</span>;
      case 'PENDING':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-900/50 text-yellow-400">Pending</span>;
      case 'FAILED':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-900/50 text-red-400">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-900/50 text-gray-400">{status}</span>;
    }
  };
  
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Transaction History</h3>
        <button
          onClick={exportToCsv}
          disabled={transactions.length === 0}
          className="btn bg-gray-700 hover:bg-gray-600 text-white text-sm py-1"
        >
          Export CSV
        </button>
      </div>
      
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Aucune transaction</p>
          <p className="text-sm mt-1">Les transactions apparaîtront ici une fois que le bot commencera à trader</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 border-b border-gray-700">
              <tr>
                <th className="pb-2">Type</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-800">
                  <td className={`py-3 ${tx.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type}
                  </td>
                  <td className="py-3">{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                  <td className="py-3">${tx.price.toFixed(6)}</td>
                  <td className="py-3">{formatDate(tx.timestamp)}</td>
                  <td className="py-3">{getStatusBadge(tx.status)}</td>
                  <td className="py-3">
                    <a 
                      href={`https://solscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {truncateHash(tx.txHash)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
