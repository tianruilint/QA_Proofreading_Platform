import React from 'react';

export const Separator = ({ 
  orientation = 'horizontal', 
  className = '', 
  ...props 
}) => {
  const orientationClasses = {
    horizontal: 'h-[1px] w-full',
    vertical: 'h-full w-[1px]',
  };
  
  return (
    <div 
      className={`shrink-0 bg-border ${orientationClasses[orientation]} ${className}`}
      {...props}
    />
  );
};

