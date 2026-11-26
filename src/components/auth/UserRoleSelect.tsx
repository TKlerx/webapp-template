"use client";

import { Combobox, InputBase, useCombobox } from "@mantine/core";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Role } from "../../../generated/prisma/enums";

export function UserRoleSelect({
  value,
  onChange,
  withLabel = false,
  disabled = false,
  readOnly = false,
  className,
  scrollContainerRef,
}: {
  value: Role;
  onChange: (role: Role) => void;
  withLabel?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("users");
  const label = t("role");
  const options = Object.values(Role).map((role) => ({
    value: role,
    label: t(`roles.${role}`),
  }));
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: "", time: 0 });
  const store = useCombobox();
  const { closeDropdown, dropdownOpened } = store;

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!dropdownOpened || !trigger) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting) closeDropdown();
    });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [closeDropdown, dropdownOpened]);

  function triggerIsClipped() {
    const container = scrollContainerRef?.current;
    const trigger = triggerRef.current;
    if (!container || !trigger) return false;
    const bounds = container.getBoundingClientRect();
    const target = trigger.getBoundingClientRect();
    return target.right <= bounds.left || target.left >= bounds.right;
  }

  function openDropdown() {
    if (triggerIsClipped()) return;
    search.current = { text: "", time: 0 };
    setActiveIndex(options.findIndex((option) => option.value === value));
    store.openDropdown();
  }

  function chooseRole(role: Role) {
    closeDropdown();
    if (!readOnly && !triggerIsClipped() && role !== value) onChange(role);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (readOnly || event.nativeEvent.isComposing) return;
    const now = event.timeStamp;
    const continuingSearch =
      !!search.current.text && now - search.current.time < 1000;
    if (event.key === " " && dropdownOpened && continuingSearch) {
      event.preventDefault();
      matchOption(" ", now, true);
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!dropdownOpened) {
          openDropdown();
          return;
        }
        const offset = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex(
          (index) => (index + offset + options.length) % options.length,
        );
        return;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (dropdownOpened) chooseRole(options[activeIndex].value);
        else openDropdown();
        return;
      case "Escape":
        if (dropdownOpened) {
          event.preventDefault();
          closeDropdown();
        }
        return;
      case "Home":
      case "End":
        if (dropdownOpened) {
          event.preventDefault();
          setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
        }
        return;
    }

    if (
      !dropdownOpened ||
      event.key.length !== 1 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    matchOption(event.key.toLocaleLowerCase(), now, continuingSearch);
  }

  function matchOption(key: string, now: number, continuingSearch: boolean) {
    const text = continuingSearch ? search.current.text + key : key;
    search.current = { text, time: now };
    const repeated = [...text].every((character) => character === key);
    const prefix = repeated ? key : text;
    const start = activeIndex + (repeated ? 1 : 0);
    const match = options
      .map((_, offset) => (start + offset) % options.length)
      .find((index) =>
        options[index].label.toLocaleLowerCase().startsWith(prefix),
      );
    if (match !== undefined) setActiveIndex(match);
  }

  return (
    <Combobox
      store={store}
      classNames={{
        dropdown: "border-border bg-popover text-popover-foreground",
      }}
      onOptionSubmit={(role) => {
        const selected = options.find((option) => option.value === role);
        if (selected) chooseRole(selected.value);
      }}
    >
      <Combobox.Target
        ref={triggerRef}
        targetType="button"
        withAriaAttributes={false}
        withKeyboardNavigation={false}
      >
        <InputBase
          component="button"
          type="button"
          role="combobox"
          label={withLabel ? label : undefined}
          aria-label={withLabel ? undefined : label}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpened}
          aria-controls={dropdownOpened ? listId : undefined}
          aria-activedescendant={
            dropdownOpened ? `${listId}-${activeIndex}` : undefined
          }
          aria-readonly={readOnly || undefined}
          data-mantine-stop-propagation={dropdownOpened || undefined}
          className={className}
          classNames={{ input: "user-management-input text-left" }}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          disabled={disabled}
          pointer={!readOnly}
          onBlur={() => closeDropdown()}
          onClick={() => {
            if (dropdownOpened) closeDropdown();
            else if (!readOnly) openDropdown();
          }}
          onKeyDown={handleKeyDown}
        >
          {t(`roles.${value}`)}
        </InputBase>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options id={listId} aria-label={label}>
          {options.map((option, index) => (
            <Combobox.Option
              id={`${listId}-${index}`}
              key={option.value}
              value={option.value}
              aria-selected={option.value === value}
              selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {option.label}
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
