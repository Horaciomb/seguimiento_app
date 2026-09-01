"use client"

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Wrapper fino sobre la primitiva de base-ui, mismo patrón que tabs.jsx / dialog.jsx /
// select.jsx. Se usa la primitiva y no un `useState` a mano porque trae gratis lo que
// costaría escribir y mantener: aria-expanded, role="region", navegación con flechas, y
// `--accordion-panel-height` para animar la apertura sin medir el contenido.
//
// `openMultiple` viene en true por defecto y es lo que se quiere acá: varios supervisores
// abiertos a la vez para comparar equipos.

function Accordion({ className, ...props }) {
  return <AccordionPrimitive.Root data-slot="accordion" className={cn("space-y-2", className)} {...props} />
}

function AccordionItem({ className, ...props }) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("rounded-xl border bg-background overflow-hidden", className)}
      {...props}
    />
  )
}

/** El trigger sólo envuelve lo que abre/cierra — los botones de acción van fuera de él. */
function AccordionTrigger({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex w-full items-center gap-2 text-left outline-none transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
        {...props}
      >
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180" />
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionPanel({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn(
        "h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0",
        className,
      )}
      {...props}
    >
      {children}
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel }
