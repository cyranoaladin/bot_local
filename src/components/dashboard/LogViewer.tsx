import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import axios from 'axios';

interface LogViewerProps {}

const LogViewer: React.FC<LogViewerProps> = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/logs');
      setLogs(response.data.logs || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des logs:', err);
      setError('Impossible de récupérer les logs. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Logs du système</Typography>
        <Button 
          startIcon={<Refresh />} 
          variant="outlined" 
          size="small" 
          onClick={fetchLogs}
          disabled={loading}
        >
          Actualiser
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : logs.length === 0 ? (
        <Typography>Aucun log disponible.</Typography>
      ) : (
        <Paper 
          sx={{ 
            p: 2, 
            maxHeight: '400px', 
            overflow: 'auto', 
            bgcolor: '#1e1e1e',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap'
          }}
        >
          {logs.map((log, index) => (
            <div key={index} className="log-line">
              {log}
            </div>
          ))}
        </Paper>
      )}
    </Box>
  );
};

export default LogViewer;
