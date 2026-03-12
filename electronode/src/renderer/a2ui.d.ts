/**
 * Type declarations for @a2ui/lit web components and modules.
 */

import "react";

// Custom element declaration for React JSX
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "a2ui-surface": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          processor?: unknown;
          surface?: unknown;
          surfaceId?: string | null;
        },
        HTMLElement
      >;
    }
  }
}

// Module declarations for @a2ui/lit (no bundled types)
declare module "@a2ui/lit" {
  export const v0_8: {
    Data: {
      createSignalA2uiMessageProcessor(): {
        processMessages(messages: unknown[]): void;
        getSurfaces(): ReadonlyMap<string, unknown>;
        clearSurfaces(): void;
      };
    };
  };
}

declare module "@a2ui/lit/ui" {
  // Side-effect import — registers custom elements globally
}
