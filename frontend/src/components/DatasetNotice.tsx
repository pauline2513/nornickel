import { useEffect, useState } from "react";
import { Modal } from "antd";
import { ExclamationOutlined } from "@ant-design/icons";

const NOTICE_STORAGE_KEY = "nornickel-dataset-notice-seen";

export function DatasetNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (!seen) {
      setOpen(true);
      localStorage.setItem(NOTICE_STORAGE_KEY, "1");
    }
  }, []);

  return (
    <>
      <button
        type="button"
        className="dataset-notice-trigger"
        aria-label="Показать предупреждение о наборе данных"
        onClick={() => setOpen(true)}
      >
        <ExclamationOutlined />
      </button>
      <Modal
        title="Прежде чем начать"
        open={open}
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        okText="Понятно"
        okButtonProps={{ className: "dataset-notice-ok" }}
        cancelButtonProps={{ style: { display: "none" } }}
        closeIcon={null}
        centered
      >
        <p>
          Граф знаний и ответы чат-бота построены только на документах текущего
          набора - задавайте вопросы по темам, которые в них раскрыты.
        </p>
        <p>
          Это MVP: набор пока ограничен файлами из раздела «Набор данных», но в
          дальнейшем он может быть расширен.
        </p>
      </Modal>
    </>
  );
}
