import { useState, useEffect, useCallback } from 'react';

const SESSION_STORAGE_KEY = 'guestSessionData';

export function useGuestSession() {
  const [sessionData, setSessionData] = useState(() => {
    try {
      const storedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return storedData ? JSON.parse(storedData) : { 
        records: [], 
        currentRecordIndex: 0,
        hiddenItems: [],
        showAll: false,
        hasMarkedCorrect: false
      };
    } catch (error) {
      console.error("Failed to parse session data from sessionStorage", error);
      return { 
        records: [], 
        currentRecordIndex: 0,
        hiddenItems: [],
        showAll: false,
        hasMarkedCorrect: false
      };
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error("Failed to save session data to sessionStorage", error);
    }
  }, [sessionData]);

  const loadRecords = useCallback((records) => {
    setSessionData({ 
      records, 
      currentRecordIndex: 0,
      hiddenItems: [],
      showAll: false,
      hasMarkedCorrect: false
    });
  }, []);

  const updateRecord = useCallback((index, newRecord) => {
    setSessionData(prevData => {
      const newRecords = [...prevData.records];
      newRecords[index] = { ...newRecords[index], ...newRecord, is_edited: true };
      return { ...prevData, records: newRecords };
    });
  }, []);

  const goToRecord = useCallback((index) => {
    setSessionData(prevData => ({
      ...prevData,
      currentRecordIndex: Math.max(0, Math.min(index, prevData.records.length - 1))
    }));
  }, []);

  const markCorrect = useCallback((qaId) => {
    setSessionData(prevData => ({
      ...prevData,
      hiddenItems: [...prevData.hiddenItems, qaId],
      hasMarkedCorrect: true
    }));
  }, []);

  const toggleShowAll = useCallback(() => {
    setSessionData(prevData => ({
      ...prevData,
      showAll: !prevData.showAll
    }));
  }, []);

  const clearSession = useCallback(() => {
    setSessionData({ 
      records: [], 
      currentRecordIndex: 0,
      hiddenItems: [],
      showAll: false,
      hasMarkedCorrect: false
    });
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  return {
    records: sessionData.records,
    currentRecordIndex: sessionData.currentRecordIndex,
    hiddenItems: sessionData.hiddenItems,
    showAll: sessionData.showAll,
    hasMarkedCorrect: sessionData.hasMarkedCorrect,
    loadRecords,
    updateRecord,
    goToRecord,
    markCorrect,
    toggleShowAll,
    clearSession,
  };
}


