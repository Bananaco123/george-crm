import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';
import '../filter-dropdown.css';

export default function FilterDropdown({ label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const listId = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];
  const optionSignature = options.map(option => option.value).join('|');

  useEffect(() => {
    setActiveIndex(Math.max(0, selectedIndex));
  }, [selectedIndex, optionSignature]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const choose = index => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const openMenu = (index = Math.max(0, selectedIndex)) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const handleKeyDown = event => {
    if (!options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex(index => Math.max(0, Math.min(options.length - 1, index + step)));
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      openMenu(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else openMenu();
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return <div ref={root} className={`filter-dropdown ${open ? 'is-open' : ''} ${className}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="filter-dropdown-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && options[activeIndex] ? `${listId}-option-${activeIndex}` : undefined} disabled={!options.length} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={handleKeyDown} title={selected?.label}>
      <span>{selected?.label || label}</span><Icon name="chevronDown" size={15} />
    </button>
    {open && <ul ref={list} id={listId} className="filter-dropdown-menu" role="listbox" aria-label={label}>
      {options.map((option, index) => <li key={option.value} id={`${listId}-option-${index}`} role="option" aria-selected={option.value === value} className={`filter-dropdown-option ${option.value === value ? 'is-selected' : ''} ${activeIndex === index ? 'is-active' : ''}`} onPointerMove={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <Icon name="check" size={15} />}
      </li>)}
    </ul>}
  </div>;
}
