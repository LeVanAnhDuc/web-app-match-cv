import { Input, Segmented, Upload } from "antd";
import { UploadCloud } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { UploadFile, UploadProps } from "antd";
import type { InputMode } from "#/types/Wizard";

const { Dragger } = Upload;
const { TextArea } = Input;

const UploadPasteTabs = ({
  mode,
  onModeChange,
  file,
  onFileChange,
  pastedText,
  onPastedTextChange,
  maxSizeLabel
}: {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  pastedText: string;
  onPastedTextChange: (text: string) => void;
  maxSizeLabel: string;
}) => {
  const { t } = useTranslation();

  const fileList: Array<UploadFile> = file
    ? [{ uid: file.name, name: file.name, status: "done" }]
    : [];

  const draggerProps: UploadProps = {
    accept: ".pdf,.docx",
    multiple: false,
    showUploadList: false,
    fileList,
    beforeUpload: (selected) => {
      onFileChange(selected);
      return false;
    },
    onRemove: () => onFileChange(null)
  };

  return (
    <div className="mb-6 md:mb-8">
      <Segmented
        value={mode}
        onChange={(value) => onModeChange(value as InputMode)}
        options={[
          { label: t("input.tab.upload"), value: "upload" },
          { label: t("input.tab.paste"), value: "paste" }
        ]}
        className="mb-8"
      />
      {mode === "upload" ? (
        <Dragger
          {...draggerProps}
          className="mb-6 !rounded-xl !border-dashed md:mb-10"
        >
          <div className="flex flex-col items-center justify-center py-4 md:py-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 md:size-16 dark:bg-indigo-500/10 dark:text-indigo-400">
              <UploadCloud size={28} />
            </div>
            <p className="mb-1 text-base font-medium text-body md:text-lg">
              {file ? (
                file.name
              ) : (
                <Trans
                  i18nKey="dropzone.title"
                  components={{
                    highlight: (
                      <span className="text-blue-600 dark:text-indigo-400" />
                    )
                  }}
                />
              )}
            </p>
            <p className="text-sm text-muted">
              {t("dropzone.hint", { max: maxSizeLabel })}
            </p>
          </div>
        </Dragger>
      ) : (
        <TextArea
          value={pastedText}
          onChange={(e) => onPastedTextChange(e.target.value)}
          rows={8}
          placeholder={t("paste.placeholder")}
          className="mb-6 !rounded-xl md:mb-10"
        />
      )}
    </div>
  );
};

export default UploadPasteTabs;
