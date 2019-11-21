import * as React from "react";
import { RecordOf } from "immutable";
import { WidgetManager } from "./widget-manager";
import BackboneWrapper from "../renderer/backbone-wrapper";
import { connect } from "react-redux";
import {
  actions,
  KernelNotStartedProps,
  LocalKernelProps,
  RemoteKernelProps,
  ContentRef
} from "@nteract/core";
import { CellId } from "@nteract/commutable";
import { WidgetModel } from "@jupyter-widgets/base";

interface ConnectedProps {
  modelById: (id: string) => Promise<WidgetModel>;
  kernel?:
    | RecordOf<KernelNotStartedProps>
    | RecordOf<LocalKernelProps>
    | RecordOf<RemoteKernelProps>
    | null;
}

export interface ManagerActions {
  actions: {
    appendOutput: (output: any) => void;
    clearOutput: () => void;
    updateCellStatus: (status: string) => void;
    promptInputRequest: (prompt: string, password: boolean) => void;
  };
}

interface OwnProps {
  model: WidgetModel;
  model_id: string;
  id: CellId;
  contentRef: ContentRef;
}

type Props = ConnectedProps & OwnProps & ManagerActions;

/**
 * This component is is a wrapper component that initializes a
 * WidgetManager singleton and passes a model reference to the
 * BackboneModelWrapper. It's doing most of the heavy lifting with
 * respect to bridging the kernels comms that the WidgetManager provides,
 * our client-side state model, and the view.
 */
class Manager extends React.Component<Props> {
  widgetContainerRef = React.createRef<HTMLDivElement>();
  /**
   * Because each contentRef will have its own Kernel, we also want it to
   * have its own WidgetManager because things like the modelById, the kernel
   * object we pass down, and potential future actions will only apply to the one
   * kernel. Also widgets will not interact with widgets in another kernel,
   * so there is no point in managing them together.
   * We get the kernel by contentRef, so that is why we use it as the key
   */
  static managerByContentRef: { [contentRef: string]: WidgetManager };

  constructor(props: Props) {
    super(props);
  }

  /**
   * Because the iPyWidgets keeps track of the widgets it creates as a
   * member variable, the WidgetManager needs to be treated like a singleton.
   * However, we still need to be constantly updating the singleton with the most up
   * to date modelById function, otherwise it will be searching a stale state for a
   * model
   */
  getManager() {
    const { contentRef, kernel, modelById, actions } = this.props;
    if (Manager.managerByContentRef === undefined) {
      Manager.managerByContentRef = {};
    }
    let manager = Manager.managerByContentRef[contentRef];
    if (manager === undefined) {
      manager = Manager.managerByContentRef[contentRef] = new WidgetManager(
        kernel,
        modelById,
        actions
      );
    } else {
      manager.update(kernel, modelById, actions);
    }
    return manager;
  }

  render() {
    return (
      <React.Fragment>
        <BackboneWrapper
          model={this.props.model.get("state")}
          manager={this.getManager()}
          model_id={this.props.model_id}
          widgetContainerRef={this.widgetContainerRef}
        />
      </React.Fragment>
    );
  }
}

const mapDispatchToProps = (dispatch: any, props: OwnProps): ManagerActions => {
  return {
    actions: {
      appendOutput: (output: any) =>
        dispatch(
          actions.appendOutput({
            id: props.id,
            contentRef: props.contentRef,
            output
          })
        ),
      clearOutput: () =>
        dispatch(
          actions.clearOutputs({
            id: props.id,
            contentRef: props.contentRef
          })
        ),
      updateCellStatus: (status: string) =>
        dispatch(
          actions.updateCellStatus({
            id: props.id,
            contentRef: props.contentRef,
            status
          })
        ),
      promptInputRequest: (prompt: string, password: boolean) =>
        dispatch(
          actions.promptInputRequest({
            id: props.id,
            contentRef: props.contentRef,
            prompt,
            password
          })
        )
    }
  };
};

export default connect(null, mapDispatchToProps)(Manager);
