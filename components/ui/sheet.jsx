import React, { useState, createContext, useContext } from 'react';

const SheetContext = createContext();

export const Sheet = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(open || false);
  
  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };
  
  return (
    <SheetContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
};

export const SheetTrigger = ({ children, asChild, ...props }) => {
  const { setIsOpen } = useContext(SheetContext);
  
  if (asChild) {
    return React.cloneElement(children, {
      ...props,
      onClick: () => setIsOpen(true)
    });
  }
  
  return (
    <button onClick={() => setIsOpen(true)} {...props}>
      {children}
    </button>
  );
};

export const SheetContent = ({ children, side = 'right', className = '', ...props }) => {
  const { isOpen, setIsOpen } = useContext(SheetContext);
  
  if (!isOpen) return null;
  
  const sideClasses = {
    left: 'left-0 h-full w-3/4 border-r',
    right: 'right-0 h-full w-3/4 border-l',
    top: 'top-0 w-full h-3/4 border-b',
    bottom: 'bottom-0 w-full h-3/4 border-t',
  };
  
  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Sheet */}
      <div 
        className={`fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out ${sideClasses[side]} ${className}`}
        {...props}
      >
        {children}
      </div>
    </>
  );
};

