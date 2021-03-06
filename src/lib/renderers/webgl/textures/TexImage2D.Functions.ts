import { passGeometry } from "../../../geometry/primitives/passGeometry";
import { ShaderMaterial } from "../../../materials/ShaderMaterial";
import { Vector2 } from "../../../math/Vector2";
import { cubeFaceTargets, CubeMapTexture } from "../../../textures/CubeTexture";
import { Texture } from "../../../textures/Texture";
import { makeBufferGeometryFromGeometry } from "../buffers/BufferGeometry";
import { Attachment } from "../framebuffers/Attachment";
import { Framebuffer } from "../framebuffers/Framebuffer";
import { renderBufferGeometry } from "../framebuffers/VirtualFramebuffer";
import { makeProgramFromShaderMaterial } from "../programs/Program";
import { RenderingContext } from "../RenderingContext";
import cubeFaceFragmentSource from "./cubeFaces/fragment.glsl";
import cubeFaceVertexSource from "./cubeFaces/vertex.glsl";
import { PixelFormat } from "./PixelFormat";
import { TexImage2D } from "./TexImage2D";
import { TexParameters } from "./TexParameters";
import { TextureFilter } from "./TextureFilter";
import { TextureTarget } from "./TextureTarget";
import { TextureWrap } from "./TextureWrap";

export function makeTexImage2DFromTexture(
  context: RenderingContext,
  texture: Texture,
  internalFormat: PixelFormat = PixelFormat.RGBA,
): TexImage2D {
  const params = new TexParameters();
  params.anisotropyLevels = texture.anisotropicLevels;
  params.generateMipmaps = texture.generateMipmaps;
  params.magFilter = texture.magFilter;
  params.minFilter = texture.minFilter;
  params.wrapS = texture.wrapS;
  params.wrapT = texture.wrapT;
  return new TexImage2D(
    context,
    [texture.image],
    texture.pixelFormat,
    texture.dataType,
    internalFormat,
    TextureTarget.Texture2D,
    params,
  );
}

export function makeTexImage2DFromCubeTexture(
  context: RenderingContext,
  texture: CubeMapTexture,
  internalFormat: PixelFormat = PixelFormat.RGBA,
): TexImage2D {
  const params = new TexParameters();
  params.anisotropyLevels = texture.anisotropicLevels;
  params.generateMipmaps = texture.generateMipmaps;
  params.magFilter = texture.magFilter;
  params.minFilter = texture.minFilter;
  params.wrapS = TextureWrap.ClampToEdge;
  params.wrapT = TextureWrap.ClampToEdge;
  return new TexImage2D(
    context,
    texture.images,
    texture.pixelFormat,
    texture.dataType,
    internalFormat,
    TextureTarget.TextureCubeMap,
    params,
  );
}

export function makeTexImage2DFromEquirectangularTexture(
  context: RenderingContext,
  latLongTexture: Texture,
  faceSize = new Vector2(512, 512),
  generateMipmaps = true,
): TexImage2D {
  // required for proper reading.
  latLongTexture.wrapS = TextureWrap.Repeat;
  latLongTexture.wrapT = TextureWrap.ClampToEdge;
  latLongTexture.minFilter = TextureFilter.Linear;

  const cubeTexture = new CubeMapTexture([faceSize, faceSize, faceSize, faceSize, faceSize, faceSize]);
  cubeTexture.generateMipmaps = generateMipmaps;

  const latLongMap = makeTexImage2DFromTexture(context, latLongTexture);
  const cubeFaceGeometry = passGeometry();
  const cubeFaceMaterial = new ShaderMaterial(cubeFaceVertexSource, cubeFaceFragmentSource);
  const cubeFaceProgram = makeProgramFromShaderMaterial(context, cubeFaceMaterial);
  const cubeFaceBufferGeometry = makeBufferGeometryFromGeometry(context, cubeFaceGeometry);
  const cubeMap = makeTexImage2DFromCubeTexture(context, cubeTexture);

  const cubeFaceFramebuffer = new Framebuffer(context);

  const cubeFaceUniforms = {
    map: latLongMap,
    faceIndex: 0,
  };

  cubeFaceTargets.forEach((target, index) => {
    cubeFaceFramebuffer.attach(Attachment.Color0, cubeMap, target, 0);
    cubeFaceUniforms.faceIndex = index;
    renderBufferGeometry(cubeFaceFramebuffer, cubeFaceProgram, cubeFaceUniforms, cubeFaceBufferGeometry);
  });

  if (generateMipmaps) {
    cubeMap.generateMipmaps();
  }

  cubeFaceFramebuffer.flush();
  cubeFaceFramebuffer.finish();

  cubeFaceFramebuffer.dispose();
  // cubeFaceBufferGeometry.dispose(); - causes crashes.  Huh?
  cubeFaceProgram.dispose();
  cubeFaceGeometry.dispose();
  latLongMap.dispose();

  return cubeMap;
}
