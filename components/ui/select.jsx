import React from 'react';

export const Select = ({ children, value, onValueChange, ...props }) => {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {children}
    </select>
  );
};

export const SelectContent = ({ children }) => {
  return <>{children}</>;
};

export const SelectItem = ({ children, value, ...props }) => {
  return (
    <option value={value} {...props}>
      {children}
    </option>
  );
};

export const SelectTrigger = ({ children, className = '', ...props }) => {
  return (
    <div className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const SelectValue = ({ placeholder, ...props }) => {
  return <span {...props}>{placeholder}</span>;
};

