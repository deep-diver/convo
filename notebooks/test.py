import json
import requests

api_key = "up_ANcdA1bxF651vbxwBuDFReIen32J2"
filename = "mat.pdf"
root_path = "mat"
from pdf2image import convert_from_path

def pdf_to_images(pdf_file_path, root_path):
    images = convert_from_path(pdf_file_path)
    image_paths = []

    for i, image in enumerate(images):
        image_path = f"{root_path}/{i+1}.png"
        image.save(image_path)
        image_paths.append(image_path)

    return image_paths

pdf_to_images(filename, root_path) 
 
# url = "https://api.upstage.ai/v1/document-ai/document-parse"
# headers = {"Authorization": f"Bearer {api_key}"}
# files = {"document": open(filename, "rb")}
# data = {"output_formats": "['markdown']"}
# response = requests.post(url, headers=headers, files=files, data=data)
# print(response.json())
# # Get the response data
# data = response.json()

# # Save to a JSON file with the same base name as the PDF
# json_filename = filename.rsplit('.', 1)[0] + '.json'
# with open(json_filename, 'w') as f:
#     json.dump(data, f, indent=2)

# print(f"Saved response to {json_filename}")
