import * as React from "react"

function Label({
  className,
  ...props
}: React.ComponentProps<"label"> & { htmlFor?: string }) {
  return <label className={className} {...props} />
}

export { Label }