import React from 'react';

export const ScrollArea = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      <div className="h-full w-full rounded-[inherit] overflow-auto">
        {children}
      </div>
    </div>
  );
};

