from ultralytics import YOLO
import torch
from torchvision import transforms

model = YOLO("yolov8s.pt")
midas = torch.hub.load('intel-isl/MiDaS', 'MiDaS_small')
midas.eval()
midas_transforms = transforms.Compose([
    transforms.ToTensor(),
    transforms.Resize((384, 384)),
    transforms.Normalize(mean=[0.5], std=[0.5])
])
depth_scale_factor = 0.05