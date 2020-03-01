import React from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import {
  SortableContainer,
  SortableElement,
  SortableHandle
} from "react-sortable-hoc";
import {
  CUSTOM_BACKGROUND_MAXIMUM_SIZE,
  CUSTOM_BACKGROUND_ALLOWED_TYPES,
  CUSTOM_BACKGROUND_MAXIMUM_LENGTH,
  CUSTOM_BACKGROUND_DEFAULT_ALIGNMENT
} from "../../../../lib/constants";
import ClearImageModal from "../ClearImageModal";
import { temporaryImageStore } from "../../middleware";

import "./index.scss";
import iconHAlignLeft from "./icon_align_left.svg";
import iconVAlignCenter from "./icon_align_center.svg";


const mapErrors = ({ tooLarge, wrongType}) => {
  if (tooLarge && wrongType) {
    return `
    The image is too large. (1MB maximum size) 
    The file is not an accepted image type.
    `;
  } else if (tooLarge) {
    return "The image is too large. (1MB maximum size)";
  } else if (wrongType) {
    return "The file is not an accepted image type.";
  }
  return "";
};

export class ThemeCustomBackgroundPicker extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidUpdate(prevProps) {
    const { themeCustomBackgrounds, themeCustomImages } = this.props;

    // sync images in local storage with custom backgrounds in preview on undo/redo
    // when custom background changes.
    if (prevProps.themeCustomBackgrounds.length !== themeCustomBackgrounds.length) {
      const keys = Object.keys(themeCustomImages);

      themeCustomBackgrounds.forEach(({ name }) => {
        const imageInStorage = this.props.storage.imageStorage.get(name);
        if (!keys.includes(name) && !imageInStorage) {
          this.addImageToStorage(name);
        }
      });
    }
  }

  handleImageAdd = ({ name }) => {
    this.props.addCustomBackground({
      name,
      tiling: "repeat",
      alignment: CUSTOM_BACKGROUND_DEFAULT_ALIGNMENT
    });
  };

  handleShouldCancelStart = e => {
    // Cancel sorting if there's only one background
    if (this.props.themeCustomBackgrounds.length <= 1) {
      return true;
    }

    // Copy default behavior: https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/index.js#L51
    // Cancel sorting if the event target is an `input`, `textarea`, `select` or `option`
    const disabledElements = [
      "input",
      "textarea",
      "select",
      "option",
      "button"
    ];

    if (disabledElements.includes(e.target.tagName.toLowerCase())) {
      return true; // Return true to cancel sorting
    }

    return false;
  };

  // HACK: Prevent default on drag to stop text highlighting
  // https://github.com/clauderic/react-sortable-hoc/issues/253#issuecomment-350223723
  handleSortStart = (_, event) => {
    event.preventDefault();
  };

  handleSortEnd = ({ oldIndex, newIndex }) => {
    this.props.moveCustomBackground({ oldIndex, newIndex });
  };

  addImageToStorage = (name) => {
    const image = temporaryImageStore.get(name);
    if (image) {
      this.props.updateImage({ ...image, importing: true });
    }
  };

  render() {
    const {
      addImage,
      updateImage,
      themeHasCustomBackgrounds,
      themeCustomBackgrounds,
      storageErrorMessage
    } = this.props;
    const label = themeHasCustomBackgrounds
      ? "Add another"
      : "...Or add your own";
    const isPrimary = themeHasCustomBackgrounds;
    return (
      <form className="custom-background" onSubmit={e => e.preventDefault()}>
        <BackgroundList
          {...this.props}
          helperClass="dragHelper"
          useDragHandle={true}
          shouldCancelStart={this.handleShouldCancelStart}
          onSortStart={this.handleSortStart}
          onSortEnd={this.handleSortEnd}
          addImageToStorage={this.addImageToStorage}
        />
        {!storageErrorMessage && (
          <ImageImporter
            {...{ addImage, updateImage, onImport: this.handleImageAdd }}
          >
            {({ importing, errors, ImportButton }) => (
              <div className="add-image">
                {themeCustomBackgrounds.length <
                  CUSTOM_BACKGROUND_MAXIMUM_LENGTH && (
                    <ImportButton {...{ label, isPrimary }} />
                  )}
                {importing && (
                  <div className="status-message importing">Processing...</div>
                )}
                {errors && (
                  <React.Fragment>
                    <Modal>
                      <div className="errors">
                        <span>{mapErrors(errors)}</span>
                      </div>
                    </Modal>
                  </React.Fragment>
                )}
              </div>
            )}
          </ImageImporter>
        )}
        {!storageErrorMessage && (
          <p className="privacy-note">
            Up to 1 MB. JPG, PNG or BMP. <br /> Images never leave your computer.
        </p>
        )}
      </form>
    );
  }
}

const modalRoot = document.getElementById("modal");

class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.el = document.createElement("div");
  }

  componentDidMount() {
    modalRoot.appendChild(this.el);
    setTimeout(() => this.el.classList.add("fade-in"), 10);
  }

  componentWillUnmount() {
    modalRoot.removeChild(this.el);
  }

  render() {
    return createPortal(this.props.children, this.el);
  }
}

const BackgroundList = SortableContainer(props => {
  const {
    clearCustomBackground,
    updateCustomBackground,
    themeCustomBackgrounds,
    themeCustomImages
  } = props;
  return (
    <ul className="backgroundList">
      {themeCustomBackgrounds.map((item, index) => (
        <SortableThemeCustomBackgroundSelector
          key={index}
          {...{
            ...props,
            item,
            index,
            image: themeCustomImages[item.name],
            clearCustomBackground: (args = {}) =>
              clearCustomBackground({ index, ...args }),
            updateCustomBackground: (args = {}) =>
              updateCustomBackground({ index, ...args })
          }}
        />
      ))}
    </ul>
  );
});

const DragHandle = SortableHandle(({ icon = "importing", errors }) => (
  <span
    className={classNames("drag-handle", "status-icon", icon)}
    title={mapErrors(errors)}
  >
    &nbsp;
  </span>
));

class ThemeCustomBackgroundSelector extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      index: null
    };
  }

  componentDidMount() {
    if (this.props.storageErrorMessage) {
      this.handleClearBackground();
    }
  }

  render() {
    const {
      handleTilingChange,
      storageErrorMessage
    } = this;
    const { addImage, updateImage, image } = this.props;
    const { tiling, alignment = "left top" } = this.props.item;
    const [horizontalAlign, verticalAlign] = alignment.split(" ");
    const alignmentState = { horizontalAlign, verticalAlign };

    const AlignButton = ({ alignment, isHorizontal = false }) => {
      const alignmentKey = isHorizontal ? "horizontalAlign" : "verticalAlign";
      const isCenter = alignment === "center";
      const icon = isCenter ? iconVAlignCenter : iconHAlignLeft;
      const newAlignmentState = { [alignmentKey]: alignment };
      return (
        <button
          title={`Align ${alignment}`}
          onClick={() => this.setAlignmentState(newAlignmentState)}
          className={classNames(
            { selected: alignmentState[alignmentKey] === alignment },
            "align-button",
            `align-button-${
            isHorizontal ? "horizontal" : "vertical"
            }-${alignment}`
          )}
        >
          <img src={icon} width="13" height="16" />
        </button>
      );
    };

    if (storageErrorMessage) {
      return <div />;
    }

    return (
      <ImageImporter
        {...{ image, addImage, updateImage, onImport: this.handleImageImport }}
      >
        {({ importing, errors, ImportButton }) => {
          let statusIcon;
          if (errors) {
            statusIcon = "error";
          } else if (importing) {
            statusIcon = "importing";
          } else {
            statusIcon = "draggable";
          }
          return (
            <li className={classNames("customBackgroundItem", { importing })}>
              <DragHandle errors={errors} icon={statusIcon} />

              {errors && (
                <Modal>
                  <ul className="errors">
                    {errors.tooLarge && (
                      <li>The image is too large. (1MB maximum size)</li>
                    )}
                    {errors.wrongType && (
                      <li>The file is not an accepted image type.</li>
                    )}
                  </ul>
                </Modal>
              )}
              {image && (
                <div className="image-preview">
                  <img src={image.image} alt={image.name} />
                  <span className="name">{image.name}</span>
                </div>
              )}

              <div className="align-group">
                {["left", "center", "right"].map((alignment, idx) => (
                  <AlignButton
                    key={idx}
                    {...{ alignment, isHorizontal: true }}
                  />
                ))}
              </div>

              <div className="align-group">
                {["top", "center", "bottom"].map((alignment, idx) => (
                  <AlignButton key={idx} {...{ alignment }} />
                ))}
              </div>

              <select
                className="tiling"
                value={tiling}
                onChange={handleTilingChange}
              >
                <option value="repeat">Repeat both ways</option>
                <option value="repeat-x">Repeat horizontally</option>
                <option value="repeat-y">Repeat vertically</option>
                <option value="no-repeat">No repeat</option>
              </select>

              <ImportButton label={errors ? "Retry" : "Replace image"} />

              {this.props.displayRemoveImageModal && this.state.index === this.props.index && (
                <div className="modal-wrapper--clear-image">
                  <ClearImageModal
                    confirm={this.confirm}
                    cancel={this.onCloseModal}
                  />
                </div>
              )}

              <button title={"Delete"} className="clear" onClick={this.handleClearBackground} />
            </li>
          );
        }}
      </ImageImporter>
    );
  }

  confirm = () => {
    this.removeImage();
    this.onCloseModal();
  }

  onCloseModal = () => {
    this.props.setDisplayRemoveImageModal({ display: false });
    localStorage.setItem("clearImageModal", true);
  }

  handleClearBackground = () => {
    if (localStorage.getItem("clearImageModal")) {
      this.removeImage();
      if (this.state.index !== null) {
        this.setState({
          index: null
        });
      }
    } else {
      this.props.setDisplayRemoveImageModal({ display: true });
      this.setState({
        index: this.props.index
      });
    }
  };

  removeImage = () => {
    const { image } = this.props;

    if (image) {
      this.props.deleteImages([image.name]);
    }

    this.props.clearCustomBackground();
  }

  handleTilingChange = ev => {
    this.props.updateCustomBackground({ tiling: ev.target.value });
  };

  handleImageImport = ({ name }) => {
    this.props.updateCustomBackground({ name });
  };

  setAlignmentState(state) {
    const { item, updateCustomBackground } = this.props;

    // HACK: This allows the alignment buttons to partially update the space
    // separated alignment value as if has horizontalAlign and verticalAlign
    // properties. Should probably live in the add-on or store.
    const { alignment = "left top" } = item;
    const [horizontalAlign = "left", verticalAlign = "top"] = alignment.split(
      " "
    );
    const alignmentState = { horizontalAlign, verticalAlign, ...state };
    const newAlignment = `${alignmentState.horizontalAlign} ${
      alignmentState.verticalAlign
      }`;

    updateCustomBackground({ alignment: newAlignment });
  }
}

const SortableThemeCustomBackgroundSelector = SortableElement(
  ThemeCustomBackgroundSelector
);

class ImageImporter extends React.Component {
  constructor(props) {
    super(props);
    this.fileInputEl = null;
  }

  state = {
    importing: false,
    error: false,
    tooLarge: false,
    wrongType: false
  };

  render() {
    const { handleFileChoice } = this;
    const { importing, error, tooLarge, wrongType } = this.state;

    return this.props.children({
      importing,
      errors: !error ? false : { tooLarge, wrongType },
      ImportButton: ({ label, isPrimary = false }) => (
        <React.Fragment>
          <input
            className="inputfile"
            type="file"
            ref={el => (this.fileInputEl = el)}
            onChange={handleFileChoice}
            aria-label={label}
          />
          <button
            title={label}
            className={classNames("import-image", { default: isPrimary })}
            onClick={() => this.fileInputEl.click()}
          >
            {label}
          </button>
        </React.Fragment>
      )
    });
  }

  resetErrorState = cb => {
    this.setState(
      {
        error: false,
        tooLarge: false,
        wrongType: false
      },
      cb
    );
  };

  handleFileChoice = ev => {
    const { addImage, updateImage, onImport } = this.props;

    const file = ev.target.files[0];

    const errorState = {
      tooLarge: file.size > CUSTOM_BACKGROUND_MAXIMUM_SIZE,
      wrongType: !CUSTOM_BACKGROUND_ALLOWED_TYPES.includes(file.type)
    };
    errorState.error = Object.values(errorState).filter(v => v).length > 0;
    // HACK: Ensure a render with a cleared error state before setting
    // the new error state, so that a new modal is animated in
    this.resetErrorState(() => this.setState(errorState));
    if (errorState.error) {
      return;
    }

    this.setState({ importing: true });
    const { name, size, type } = file;
    addImage({ name, size, type });

    const reader = new FileReader();
    reader.onload = ev => {
      this.setState({ importing: false });
      updateImage({ name, image: ev.target.result });
      onImport(file);
    };
    reader.readAsDataURL(file);
  };
}

export default ThemeCustomBackgroundPicker;
