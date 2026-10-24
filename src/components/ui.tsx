"use client";
import { useId, isValidElement, cloneElement, type ReactElement } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Coffee } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
          aria-describedby={undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="modal-header">
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Close className="icon-button" aria-label="閉じる">
                <X size={20} />
              </Dialog.Close>
            </header>
            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const generated = useId();
  const child = isValidElement<{id?:string}>(children) ? children : null;
  const id = child?.props.id || generated;
  return <div className="field"><label htmlFor={id}>{label}</label>{child ? cloneElement(child,{id}) : children}</div>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Coffee size={38} />
      <h3>{title}</h3>
      <p>
        {children || "まずはひとつ追加して、イベントの準備を始めましょう。"}
      </p>
    </div>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{children}</p>
      <footer>
        <button onClick={onClose}>キャンセル</button>
        <button
          className="primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          実行する
        </button>
      </footer>
    </Modal>
  );
}
