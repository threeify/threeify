import {
  BufferBit,
  ClearState,
  fetchImage,
  makeBufferGeometryFromGeometry,
  makeMatrix4OrthographicSimple,
  makeMatrix4Translation,
  makeProgramFromShaderMaterial,
  makeTexImage2DFromTexture,
  makeTextureFromVideoElement,
  Matrix4,
  planeGeometry,
  renderBufferGeometry,
  RenderingContext,
  ShaderMaterial,
  TexImage2D,
  Texture,
  Vector2,
  Vector2View,
  Vector3,
} from "../../../lib/index";
import fragmentSource from "./fragment.glsl";
import vertexSource from "./vertex.glsl";

async function init(): Promise<null> {
  const geometry = planeGeometry(1.0, 0.5);
  const uvs = geometry.attributes["uv"];
  if (uvs !== undefined) {
    const uvView = new Vector2View(uvs.attributeData.arrayBuffer);
    const uv = new Vector2();
    for (let u = 0; u < uvView.count; u++) {
      uvView.get(u, uv);
      uv.y = 1.0 - uv.y;
      uvView.set(u, uv);
    }
  }
  const material = new ShaderMaterial(vertexSource, fragmentSource);
  const clickToPlayTexture = new Texture(await fetchImage("/assets/textures/videos/ClickToPlay.png"));

  const context = new RenderingContext(document.getElementById("framebuffer") as HTMLCanvasElement);
  const canvasFramebuffer = context.canvasFramebuffer;
  window.addEventListener("resize", () => canvasFramebuffer.resize());

  const program = makeProgramFromShaderMaterial(context, material);
  const clickToPlayMap = makeTexImage2DFromTexture(context, clickToPlayTexture);
  const uniforms = {
    localToWorld: new Matrix4(),
    worldToView: makeMatrix4Translation(new Vector3(0, 0, -1)),
    viewToScreen: makeMatrix4OrthographicSimple(1.5, new Vector2(), 0.1, 2.0, 1.0, canvasFramebuffer.aspectRatio),
    viewLightPosition: new Vector3(0, 0, 0),
    map: clickToPlayMap,
  };

  const video = document.createElement("video");
  const source = document.createElement("source");
  source.type = "video/mp4";
  source.src = "/assets/textures/videos/sintel.mp4";
  video.appendChild(source);

  let videoTexture: Texture | undefined = undefined;
  let videoMap: TexImage2D | undefined = undefined;

  const body = document.getElementsByTagName("body")[0];
  body.addEventListener(
    "click",
    async function (): Promise<void> {
      if (videoTexture === undefined) {
        await video.play();
        video.currentTime = 3; // jump ahead to content
        videoTexture = makeTextureFromVideoElement(video);
      }
    },
    false,
  );

  const bufferGeometry = makeBufferGeometryFromGeometry(context, geometry);
  const whiteClearState = new ClearState(new Vector3(1, 1, 1), 1.0);

  function animate(): void {
    const now = Date.now();
    uniforms.localToWorld = makeMatrix4Translation(
      new Vector3(Math.cos(now * 0.00077) * 0.25, Math.sin(now * 0.001 + 0.4) * 0.25, 0.0),
      uniforms.localToWorld,
    );
    if (videoTexture !== undefined && video.readyState >= video.HAVE_CURRENT_DATA) {
      if (videoMap === undefined) {
        videoMap = makeTexImage2DFromTexture(context, videoTexture);
        uniforms.map = videoMap;
      }
      videoMap.loadImages([video]);
    }
    canvasFramebuffer.clear(BufferBit.All, whiteClearState);
    renderBufferGeometry(canvasFramebuffer, program, uniforms, bufferGeometry);

    requestAnimationFrame(animate);
  }

  animate();

  return null;
}

init();
