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
    // BUG 2 修复点: 确保加载时就有原始索引
    const recordsWithIndex = records.map((record, index) => ({
      ...record,
      index_in_file: record.index_in_file !== undefined ? record.index_in_file : index,
    }));
    setSessionData({ 
      records: recordsWithIndex, 
      currentRecordIndex: 0,
      hiddenItems: [],
      showAll: false,
      hasMarkedCorrect: false
    });
  }, []);

  // BUG 3 修复: 按 qaId 更新，而不是按 index
  const updateRecord = useCallback((qaId, newRecord) => {
    setSessionData(prevData => {
      const recordIndex = prevData.records.findIndex(r => r.id === qaId);
      if (recordIndex === -1) {
        console.error("Could not find record to update with id:", qaId);
        return prevData; // 未找到则不更新
      }
      const newRecords = [...prevData.records];
      newRecords[recordIndex] = { ...newRecords[recordIndex], ...newRecord, is_edited: true };
      return { ...prevData, records: newRecords };
    });
  }, []);

  // BUG 1 修复: 实现 deleteRecord 函数
  const deleteRecord = useCallback((qaId) => {
    setSessionData(prevData => {
      const newRecords = prevData.records.filter(r => r.id !== qaId);
      const newHiddenItems = prevData.hiddenItems.filter(id => id !== qaId);
      return {
        ...prevData,
        records: newRecords,
        hiddenItems: newHiddenItems,
      };
    });
  }, []);

  const goToRecord = useCallback((index) => {
    setSessionData(prevData => ({
      ...prevData,
      currentRecordIndex: Math.max(0, Math.min(index, prevData.records.length - 1))
    }));
  }, []);

  // BUG 6 修复: 将 markCorrect 改为 toggle 逻辑
  const markCorrect = useCallback((qaId) => {
    setSessionData(prevData => {
      const isAlreadyHidden = prevData.hiddenItems.includes(qaId);
      const newHiddenItems = isAlreadyHidden
        ? prevData.hiddenItems.filter(id => id !== qaId)
        : [...prevData.hiddenItems, qaId];

      return {
        ...prevData,
        hiddenItems: newHiddenItems,
        hasMarkedCorrect: prevData.hasMarkedCorrect || !isAlreadyHidden, // 只要标记过一次就为 true
      };
    });
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
    deleteRecord, // BUG 1 修复: 导出函数
  };
}

