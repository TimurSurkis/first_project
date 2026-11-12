import { useEffect, useRef, useState } from 'react'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { DropdownOption } from './types'

interface DropdownProps<T extends string | number> {
	options: readonly DropdownOption<T>[]
	value: T | null
	onChange: (value: T) => void
	placeholder?: string
	width?: CSSProperties['width']
}

function Dropdown<T extends string | number>({
	options,
	value,
	onChange,
	placeholder = '',
	width,
}: DropdownProps<T>) {
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)
	const rootRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

	const selectedIndex = options.findIndex((option) => option.value === value)
	const selected = selectedIndex >= 0 ? options[selectedIndex] : null
	const lastIndex = options.length - 1

	useEffect(() => {
		if (!open) return

		const handlePointerDown = (event: PointerEvent) => {
			if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) {
				setOpen(false)
			}
		}

		document.addEventListener('pointerdown', handlePointerDown)
		return () => document.removeEventListener('pointerdown', handlePointerDown)
	}, [open])

	useEffect(() => {
		if (open) optionRefs.current[activeIndex]?.focus()
	}, [open, activeIndex])

	function openMenu() {
		setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
		setOpen(true)
	}

	function closeMenu() {
		setOpen(false)
	}

	function handleSelect(option: DropdownOption<T>): void {
		onChange(option.value)
		closeMenu()
		triggerRef.current?.focus()
	}

	function handleTriggerKeydown(event: KeyboardEvent<HTMLButtonElement>): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			openMenu()
		}
	}

	function handleMenuKeydown(event: KeyboardEvent<HTMLDivElement>): void {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				setActiveIndex((index) => Math.min(index + 1, lastIndex))
				break
			case 'ArrowUp':
				event.preventDefault()
				setActiveIndex((index) => Math.max(index - 1, 0))
				break
			case 'Home':
				event.preventDefault()
				setActiveIndex(0)
				break
			case 'End':
				event.preventDefault()
				setActiveIndex(lastIndex)
				break
			case 'Escape':
				event.preventDefault()
				event.stopPropagation()
				closeMenu()
				triggerRef.current?.focus()
				break
			case 'Tab':
				closeMenu()
				break
		}
	}

	return (
		<div className="dropdown" ref={rootRef} style={width ? { width } : undefined}>
			<button
				ref={triggerRef}
				type="button"
				className="dropdown-trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => (open ? closeMenu() : openMenu())}
				onKeyDown={handleTriggerKeydown}
			>
				{selected?.color && (
					<span
						className="swatch"
						style={{ background: selected.color }}
						aria-hidden="true"
					/>
				)}
				<span className={selected ? undefined : 'dropdown-placeholder'}>
					{selected ? selected.label : placeholder}
				</span>
				<LuChevronDown aria-hidden="true" />
			</button>

			{open && (
				<div
					className="dropdown-menu"
					role="listbox"
					onKeyDown={handleMenuKeydown}
				>
					{options.map((option, index) => {
						const isSelected = index === selectedIndex
						return (
							<button
								key={String(option.value)}
								ref={(element) => {
									optionRefs.current[index] = element
								}}
								type="button"
								role="option"
								aria-selected={isSelected}
								className={`dropdown-item${isSelected ? ' active' : ''}`}
								onClick={() => handleSelect(option)}
							>
								{option.color && (
									<span
										className="swatch"
										style={{ background: option.color }}
										aria-hidden="true"
									/>
								)}
								<span>{option.label}</span>
								{isSelected && (
									<LuCheck className="dropdown-check" aria-hidden="true" />
								)}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}

export default Dropdown
