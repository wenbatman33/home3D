"""Offline Intel Open Image Denoise pass for baked irradiance atlases (not run by the site)."""
import ctypes as C, pathlib, numpy as np, sys
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
lib=C.CDLL('/Applications/Blender.app/Contents/Resources/lib/libOpenImageDenoise.dylib')
ptr=C.c_void_p;size=C.c_size_t
lib.oidnNewDevice.argtypes=[C.c_int];lib.oidnNewDevice.restype=ptr
lib.oidnSetDeviceInt.argtypes=[ptr,C.c_char_p,C.c_int];lib.oidnCommitDevice.argtypes=[ptr]
lib.oidnNewFilter.argtypes=[ptr,C.c_char_p];lib.oidnNewFilter.restype=ptr
lib.oidnSetSharedFilterImage.argtypes=[ptr,C.c_char_p,ptr,C.c_int,size,size,size,size,size]
lib.oidnSetFilterBool.argtypes=[ptr,C.c_char_p,C.c_bool];lib.oidnCommitFilter.argtypes=[ptr];lib.oidnExecuteFilter.argtypes=[ptr]
lib.oidnGetDeviceError.argtypes=[ptr,C.POINTER(C.c_char_p)];lib.oidnGetDeviceError.restype=C.c_int
lib.oidnReleaseFilter.argtypes=[ptr];lib.oidnReleaseDevice.argtypes=[ptr]
dev=lib.oidnNewDevice(1);lib.oidnSetDeviceInt(dev,b'numThreads',3);lib.oidnCommitDevice(dev)
for path in sorted((ROOT/'assets/lighting').glob('m*.png')):
 if len(sys.argv)>1 and path.name not in sys.argv[1:]:continue
 image=Image.open(path).convert('RGB');a=np.array(image,dtype=np.float32)/255;out=np.empty_like(a);h,w,_=a.shape
 f=lib.oidnNewFilter(dev,b'RT');lib.oidnSetSharedFilterImage(f,b'color',a.ctypes.data,3,w,h,0,0,0);lib.oidnSetSharedFilterImage(f,b'output',out.ctypes.data,3,w,h,0,0,0)
 lib.oidnSetFilterBool(f,b'hdr',False);lib.oidnSetFilterBool(f,b'srgb',False);lib.oidnCommitFilter(f);lib.oidnExecuteFilter(f)
 msg=C.c_char_p();err=lib.oidnGetDeviceError(dev,C.byref(msg))
 if err:raise RuntimeError(msg.value.decode())
 Image.fromarray(np.clip(out*255+.5,0,255).astype('uint8')).save(path,optimize=True);lib.oidnReleaseFilter(f);print('DENOISED',path.name,flush=True)
lib.oidnReleaseDevice(dev)
